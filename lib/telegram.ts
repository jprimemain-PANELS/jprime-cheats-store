import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Telegram purchase notifications.
 *
 * Any number of DESTINATIONS can be configured in Admin -> Telegram. A destination is a
 * chat (your private chat with a bot, or a channel / group) plus the bot that posts there,
 * and a KEY MODE that decides what that chat sees of the purchased key:
 *
 *   full    -> the complete key              (use for YOUR personal bot only)
 *   masked  -> 87****78                      (use for public channels)
 *   hidden  -> no key line at all
 *
 * Settings live in the `app_settings` table (service-role only, never sent to the browser).
 * If nothing has been configured there yet, the old environment variables
 * (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID) keep working and are treated as a "full key"
 * personal destination, so notifications never stop during the move.
 */

export type KeyMode = "full" | "masked" | "hidden";
export const KEY_MODES: KeyMode[] = ["full", "masked", "hidden"];

export interface TelegramDestination {
  id: string;
  name: string;
  chat_id: string;
  key_mode: KeyMode;
  enabled: boolean;
  /** This destination's own bot token. */
  bot_token?: string;
  /** Or: reuse the bot token of another destination (id). */
  token_from?: string;
}

const SETTINGS_TABLE = "app_settings";
const SETTINGS_KEY = "telegram_destinations";
const CACHE_MS = 5_000;
const MAX_DESTINATIONS = 20;

const TOKEN_RE = /^\d{6,12}:[A-Za-z0-9_-]{30,60}$/;
const CHAT_RE = /^(-?\d{5,20}|@[A-Za-z][A-Za-z0-9_]{3,31})$/;
const SETUP_HINT =
  "Settings table not found. Run supabase/PAYMENT_GATEWAY_SWITCH.sql in the Supabase SQL editor first.";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** "87****78": first and last characters stay visible, the middle is hidden. */
export function maskKey(key: string): string {
  const k = String(key ?? "").trim();
  if (!k) return "";
  if (k.length <= 4) return "****";
  const visible = k.length >= 8 ? 2 : 1;
  return `${k.slice(0, visible)}****${k.slice(-visible)}`;
}

function tokenHint(token: string): string {
  return token ? `••••${token.slice(-4)}` : "";
}

function normalize(raw: any): TelegramDestination | null {
  if (!raw || typeof raw !== "object") return null;
  const id = clean(raw.id);
  const chat_id = clean(raw.chat_id);
  if (!id || !chat_id) return null;
  const mode = KEY_MODES.includes(raw.key_mode) ? (raw.key_mode as KeyMode) : "masked";
  const d: TelegramDestination = {
    id,
    name: clean(raw.name).slice(0, 40) || "Destination",
    chat_id,
    key_mode: mode,
    enabled: raw.enabled !== false,
  };
  const token = clean(raw.bot_token);
  const from = clean(raw.token_from);
  if (token) d.bot_token = token;
  else if (from) d.token_from = from;
  return d;
}

/* ------------------------------------------------------------------ */
/* settings storage                                                    */
/* ------------------------------------------------------------------ */

type Snapshot = { ready: boolean; stored: TelegramDestination[] | null; at: number };
let cache: Snapshot | null = null;

export function invalidateTelegramCache() {
  cache = null;
}

async function loadStored(force = false): Promise<Snapshot> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache;

  const { data, error } = await supabaseAdmin
    .from(SETTINGS_TABLE)
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  let snap: Snapshot;
  if (error) {
    snap = { ready: false, stored: null, at: Date.now() };
  } else {
    const list = (data as any)?.value?.destinations;
    snap = {
      ready: true,
      stored: Array.isArray(list) ? (list.map(normalize).filter(Boolean) as TelegramDestination[]) : null,
      at: Date.now(),
    };
  }
  cache = snap;
  return snap;
}

function envDestination(): TelegramDestination | null {
  const token = clean(process.env.TELEGRAM_BOT_TOKEN);
  const chat = clean(process.env.TELEGRAM_CHAT_ID);
  if (!token || !chat) return null;
  return {
    id: "env",
    name: "Personal bot (server settings)",
    chat_id: chat,
    key_mode: "full",
    enabled: true,
    bot_token: token,
  };
}

/** Saved destinations win. The env bot is only used while nothing has been saved yet. */
function effectiveDestinations(snap: Snapshot): { list: TelegramDestination[]; source: "admin" | "env" | "none" } {
  if (snap.stored) return { list: snap.stored, source: "admin" };
  const env = envDestination();
  return env ? { list: [env], source: "env" } : { list: [], source: "none" };
}

function resolveToken(d: TelegramDestination, all: TelegramDestination[]): string {
  if (d.bot_token) return d.bot_token;
  if (d.token_from) {
    const src = all.find((x) => x.id === d.token_from);
    if (src?.bot_token) return src.bot_token;
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* Telegram API                                                        */
/* ------------------------------------------------------------------ */

type TgResult = { ok: boolean; error?: string; result?: any };

async function tg(token: string, method: string, payload: Record<string, unknown>): Promise<TgResult> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const json: any = await res.json().catch(() => null);
    if (json?.ok) return { ok: true, result: json.result };
    return { ok: false, error: String(json?.description || `Telegram HTTP ${res.status}`) };
  } catch {
    // Never log the URL: it contains the bot token.
    return { ok: false, error: "Could not reach Telegram (timeout or network error)." };
  }
}

function sendMessage(token: string, chatId: string, text: string) {
  return tg(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

/* ------------------------------------------------------------------ */
/* purchase notification                                               */
/* ------------------------------------------------------------------ */

export interface PurchaseNotice {
  username: string;
  product: string;
  duration: string;
  amount: number;
  method?: string;
  /** The released key. Each destination decides how much of it to show. */
  key?: string;
}

function buildPurchaseMessage(n: PurchaseNotice, mode: KeyMode): string {
  const time = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  const key = String(n.key ?? "").trim();
  let keyLine = "";
  if (key && mode === "full") keyLine = `\n🔑 Key : <code>${esc(key)}</code>`;
  else if (key && mode === "masked") keyLine = `\n🔑 Key : <code>${esc(maskKey(key))}</code>`;

  return `🛒 <b>New Purchase${n.method ? ` via ${esc(n.method)}` : ""}</b>

👤 User : <b>${esc(n.username)}</b>
📦 Product : <b>${esc(n.product)}</b>
⏳ Duration : <b>${esc(n.duration)}</b>
💰 Paid : <b>₹${esc(n.amount)}</b>
🕒 Time : <b>${esc(time)}</b>${keyLine}

✅ <b>Key Released</b>`;
}

/** Best effort: never throws, so a Telegram problem can never lose a customer's key. */
export async function sendTelegramPurchase(notice: PurchaseNotice) {
  try {
    const snap = await loadStored();
    const { list } = effectiveDestinations(snap);
    const targets = list.filter((d) => d.enabled);
    if (targets.length === 0) return;

    await Promise.allSettled(
      targets.map(async (d) => {
        const token = resolveToken(d, list);
        if (!token || !d.chat_id) return;
        const result = await sendMessage(token, d.chat_id, buildPurchaseMessage(notice, d.key_mode));
        if (!result.ok) {
          console.error("TELEGRAM SEND FAILED:", { destination: d.name, error: result.error });
        }
      })
    );
  } catch (e) {
    console.error("TELEGRAM NOTIFY ERROR:", e instanceof Error ? e.message : "unknown");
  }
}

/* ------------------------------------------------------------------ */
/* admin helpers                                                       */
/* ------------------------------------------------------------------ */

export interface TelegramAdminView {
  storageReady: boolean;
  source: "admin" | "env" | "none";
  envAvailable: boolean;
  destinations: {
    id: string;
    name: string;
    chat_id: string;
    key_mode: KeyMode;
    enabled: boolean;
    hasToken: boolean;
    tokenHint: string;
    token_from: string;
    readOnly: boolean;
  }[];
}

export async function getTelegramAdminView(): Promise<TelegramAdminView> {
  const snap = await loadStored(true);
  const { list, source } = effectiveDestinations(snap);

  return {
    storageReady: snap.ready,
    source,
    envAvailable: !!envDestination(),
    destinations: list.map((d) => {
      const token = resolveToken(d, list);
      return {
        id: d.id,
        name: d.name,
        chat_id: d.chat_id,
        key_mode: d.key_mode,
        enabled: d.enabled,
        hasToken: !!token,
        tokenHint: tokenHint(token),
        token_from: d.token_from || "",
        readOnly: source === "env",
      };
    }),
  };
}

async function writeDestinations(list: TelegramDestination[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabaseAdmin
    .from(SETTINGS_TABLE)
    .upsert(
      { key: SETTINGS_KEY, value: { destinations: list }, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  if (error) {
    console.error("TELEGRAM SETTINGS WRITE ERROR:", error.message);
    return { ok: false, error: SETUP_HINT };
  }
  invalidateTelegramCache();
  return { ok: true };
}

/** Replaces the whole list. Existing bot tokens are kept unless a new one is supplied. */
export async function saveTelegramDestinations(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Array.isArray(input)) return { ok: false, error: "Invalid data." };
  if (input.length > MAX_DESTINATIONS) return { ok: false, error: `At most ${MAX_DESTINATIONS} destinations.` };

  const snap = await loadStored(true);
  if (!snap.ready) return { ok: false, error: SETUP_HINT };

  const previous = new Map((snap.stored || []).map((d) => [d.id, d]));
  const out: TelegramDestination[] = [];
  const seen = new Set<string>();

  for (const raw of input as any[]) {
    const rawId = clean(raw?.id);
    const id = /^[A-Za-z0-9_-]{1,64}$/.test(rawId) && rawId !== "env" ? rawId : randomUUID();
    if (seen.has(id)) return { ok: false, error: "Duplicate destination." };
    seen.add(id);

    const name = clean(raw?.name).slice(0, 40) || "Destination";
    const chat_id = clean(raw?.chat_id);
    if (!CHAT_RE.test(chat_id)) {
      return {
        ok: false,
        error: `"${name}": the chat / channel ID looks wrong. Use a number like -1001234567890, or @channelname for a public channel.`,
      };
    }

    const d: TelegramDestination = {
      id,
      name,
      chat_id,
      key_mode: KEY_MODES.includes(raw?.key_mode) ? raw.key_mode : "masked",
      enabled: raw?.enabled !== false,
    };

    const newToken = clean(raw?.bot_token);
    const from = clean(raw?.token_from);
    if (newToken) {
      if (!TOKEN_RE.test(newToken)) {
        return { ok: false, error: `"${name}": that bot token doesn't look right. Copy it again from @BotFather.` };
      }
      d.bot_token = newToken;
    } else if (from) {
      d.token_from = from;
    } else if (previous.get(id)?.bot_token) {
      d.bot_token = previous.get(id)!.bot_token;
    }
    out.push(d);
  }

  for (const d of out) {
    if (d.token_from) {
      const src = out.find((x) => x.id === d.token_from);
      if (!src || !src.bot_token || src.id === d.id) {
        return { ok: false, error: `"${d.name}": the bot it should share is missing or has no token.` };
      }
    } else if (!d.bot_token) {
      return { ok: false, error: `"${d.name}" needs a bot token.` };
    }
  }

  return writeDestinations(out);
}

/** Copies the bot + chat from the server environment into the saved list (full key). */
export async function importEnvDestination(): Promise<{ ok: true } | { ok: false; error: string }> {
  const env = envDestination();
  if (!env) return { ok: false, error: "No TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID found on the server." };

  const snap = await loadStored(true);
  if (!snap.ready) return { ok: false, error: SETUP_HINT };

  const list = [...(snap.stored || [])];
  if (list.some((d) => d.bot_token === env.bot_token && d.chat_id === env.chat_id)) {
    return { ok: false, error: "This bot and chat are already in the list." };
  }
  list.unshift({ ...env, id: "personal", name: "Personal bot (full key)" });
  return writeDestinations(list);
}

function friendlyTelegramError(err?: string): string {
  const e = String(err || "");
  if (/chat not found/i.test(e)) {
    return 'Chat not found. Press Start in the bot (personal chat) or add the bot as an admin of the channel, then use "Find chat ID".';
  }
  if (/bot was kicked|not a member|forbidden/i.test(e)) {
    return 'The bot can\'t post there. Add it to the channel as an administrator with "Post messages".';
  }
  if (/unauthorized|not found/i.test(e)) return "Telegram rejected the bot token. Copy it again from @BotFather.";
  return e || "Telegram rejected the message.";
}

/** Sends a clearly-marked sample message using the destination's real key mode. */
export async function testTelegramDestination(
  id: string,
  customText?: string
): Promise<{ ok: boolean; message: string }> {
  const snap = await loadStored(true);
  const { list } = effectiveDestinations(snap);
  const d = list.find((x) => x.id === id);
  if (!d) return { ok: false, message: "Destination not found. Save your changes first." };

  const token = resolveToken(d, list);
  if (!token) return { ok: false, message: "This destination has no bot token." };

  // An admin-edited test message is sent as plain text; otherwise the standard sample is used.
  const custom = String(customText ?? "").trim().slice(0, 1000);
  const text = custom
    ? esc(custom)
    : `🧪 <b>Test notification</b>\n\n` +
    buildPurchaseMessage(
      { username: "demo_user", product: "Sample Product", duration: "1 DAY", amount: 100, method: "Test", key: "AB12CD34EF56" },
      d.key_mode
    );
  const res = await sendMessage(token, d.chat_id, text);
  return res.ok
    ? { ok: true, message: `Sent to "${d.name}". Check Telegram.` }
    : { ok: false, message: friendlyTelegramError(res.error) };
}

/**
 * Finds chat IDs for a bot by reading its recent updates (no side effects).
 * Works for people who pressed Start / wrote to the bot, and for channels / groups where the
 * bot is an admin or member and something was posted recently.
 */
export async function detectTelegramChats(input: {
  id?: string;
  bot_token?: string;
}): Promise<{ ok: boolean; message?: string; bot?: string; chats: { id: string; title: string; type: string }[] }> {
  let token = clean(input.bot_token);

  if (!token && input.id) {
    const snap = await loadStored(true);
    const { list } = effectiveDestinations(snap);
    const d = list.find((x) => x.id === input.id);
    if (d) token = resolveToken(d, list);
  }
  if (!token) return { ok: false, message: "Enter the bot token first.", chats: [] };
  if (!TOKEN_RE.test(token)) return { ok: false, message: "That bot token doesn't look right.", chats: [] };

  const me = await tg(token, "getMe", {});
  if (!me.ok) return { ok: false, message: friendlyTelegramError(me.error), chats: [] };
  const botName = me.result?.username ? `@${me.result.username}` : "";

  const upd = await tg(token, "getUpdates", {
    limit: 100,
    timeout: 0,
    allowed_updates: ["message", "channel_post", "my_chat_member"],
  });
  if (!upd.ok) return { ok: false, bot: botName, message: friendlyTelegramError(upd.error), chats: [] };

  const found = new Map<string, { id: string; title: string; type: string }>();
  for (const u of upd.result || []) {
    const chat = u?.message?.chat || u?.channel_post?.chat || u?.my_chat_member?.chat;
    if (!chat?.id) continue;
    const id = String(chat.id);
    const title =
      chat.title ||
      [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
      (chat.username ? `@${chat.username}` : id);
    found.set(id, { id, title: String(title), type: String(chat.type || "chat") });
  }

  const chats = [...found.values()];
  return {
    ok: true,
    bot: botName,
    chats,
    message: chats.length
      ? undefined
      : 'No chats found yet. Send "hi" to the bot (or post something in the channel after adding the bot as admin), then press Find again.',
  };
}

/** Used by /api/test-telegram: sends the test to every enabled destination. */
export async function testAllTelegram(): Promise<{ name: string; ok: boolean; message: string }[]> {
  const snap = await loadStored(true);
  const { list } = effectiveDestinations(snap);
  const results: { name: string; ok: boolean; message: string }[] = [];
  for (const d of list.filter((x) => x.enabled)) {
    const r = await testTelegramDestination(d.id);
    results.push({ name: d.name, ok: r.ok, message: r.message });
  }
  return results;
}