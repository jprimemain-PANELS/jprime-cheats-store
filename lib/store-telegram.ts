import { readSetting, writeSetting } from "@/lib/tenant-db";

/**
 * Per-store Telegram alerts for CO-ADMIN stores. The owner's own destinations (lib/telegram.ts) are untouched.
 * One bot token + one chat id per store, stored under that store's own prefixed settings key.
 * The token is never returned to the browser (only a masked hint) and is never logged.
 */

const KEY = "store_telegram";
export type StoreKeyMode = "hidden" | "masked" | "full";
type Stored = { bot_token?: string; chat_id?: string; enabled?: boolean; key_mode?: StoreKeyMode };

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const modes: StoreKeyMode[] = ["hidden", "masked", "full"];

async function load(tenantId: string): Promise<Stored> {
  const { data, error } = await readSetting(tenantId, KEY);
  if (error || !data?.value || typeof data.value !== "object") return {};
  return data.value as Stored;
}

async function tg(token: string, method: string, payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    const j: any = await res.json().catch(() => null);
    return j?.ok ? { ok: true } : { ok: false, error: String(j?.description || `Telegram HTTP ${res.status}`).slice(0, 160) };
  } catch {
    return { ok: false, error: "Could not reach Telegram." }; // never log the URL (it has the token)
  }
}

export async function getStoreTelegramView(tenantId: string) {
  const c = await load(tenantId);
  const t = String(c.bot_token ?? "");
  return { enabled: c.enabled === true, chatId: String(c.chat_id ?? ""), hasToken: !!t, tokenHint: t ? `••••${t.slice(-4)}` : "", keyMode: modes.includes(c.key_mode as any) ? (c.key_mode as StoreKeyMode) : "hidden" };
}

export async function saveStoreTelegram(tenantId: string, input: any): Promise<{ ok: true } | { ok: false; error: string }> {
  const cur = await load(tenantId);
  const next: Stored = { ...cur };
  if (typeof input?.botToken === "string" && input.botToken.trim()) {
    const t = input.botToken.trim();
    if (!/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/.test(t)) return { ok: false, error: "That bot token does not look right. Copy it from @BotFather." };
    next.bot_token = t;
  }
  if (input?.clearToken === true) delete next.bot_token;
  if (typeof input?.chatId === "string") {
    const c = input.chatId.trim();
    if (c && !/^(-?\d{5,20}|@[A-Za-z0-9_]{4,32})$/.test(c)) return { ok: false, error: "Chat ID should be a number like -1001234567890 or @yourchannel." };
    next.chat_id = c;
  }
  if (typeof input?.enabled === "boolean") next.enabled = input.enabled;
  if (modes.includes(input?.keyMode)) next.key_mode = input.keyMode;
  const { error } = await writeSetting(tenantId, KEY, next);
  return error ? { ok: false, error: "Could not save." } : { ok: true };
}

export async function testStoreTelegram(tenantId: string): Promise<{ ok: boolean; message: string }> {
  const c = await load(tenantId);
  if (!c.bot_token || !c.chat_id) return { ok: false, message: "Save the bot token and chat ID first." };
  const r = await tg(c.bot_token, "sendMessage", { chat_id: c.chat_id, text: "✅ Test message. Your store alerts are working." });
  return r.ok ? { ok: true, message: "Test message sent. Check Telegram." } : { ok: false, message: r.error || "Failed." };
}

export type StoreNotice = { username: string; product: string; duration: string; amount: number; method?: string; key?: string };

/** Best effort, never throws: a Telegram problem must never lose a customer's key. */
export async function sendStorePurchase(tenantId: string, n: StoreNotice, storeName = "Store") {
  try {
    const c = await load(tenantId);
    if (!c.enabled || !c.bot_token || !c.chat_id) return;
    const key = String(n.key ?? "").trim();
    const mode = modes.includes(c.key_mode as any) ? c.key_mode! : "hidden";
    const keyLine = !key || mode === "hidden" ? "" : mode === "masked" ? `\n🔑 <b>Key</b>: <code>${esc(key.slice(0, 3))}••••${esc(key.slice(-3))}</code>` : `\n🔑 <b>Key</b>: <code>${esc(key)}</code>`;
    const text = `🛒 <b>NEW PURCHASE</b> · ${esc(storeName)}${n.method ? ` · ${esc(n.method)}` : ""}\n👤 ${esc(n.username)}\n📦 ${esc(n.product)}\n⏳ ${esc(n.duration)}\n💰 ₹${esc(n.amount)}${keyLine}`;
    const r = await tg(c.bot_token, "sendMessage", { chat_id: c.chat_id, text, parse_mode: "HTML", disable_web_page_preview: true });
    if (!r.ok) console.error("STORE TELEGRAM FAILED:", r.error);
  } catch {
    console.error("STORE TELEGRAM ERROR");
  }
}
