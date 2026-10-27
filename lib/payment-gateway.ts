import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * UPI payment gateway layer.
 *
 *  - "xyz"  : the original FamPay gateway (xyzcheats.com). Customer must type the UTR.
 *  - "anuj" : the new FamPay gateway (gateway.anujbots.in). No UTR needed; the order is
 *             confirmed with the order_id only.
 *
 * The ACTIVE gateway (used for NEW orders) and each gateway's URLs / API key can be changed
 * from Admin -> Payments. Every order remembers the gateway that created it (`gateway`
 * column), so an order is always verified on the gateway it was created on, even if the
 * active gateway is switched while someone is paying.
 *
 * Settings live in the `app_settings` table (service-role only). If the table does not
 * exist yet, the code falls back to environment variables (FP_API_KEY / ANUJ_API_KEY and
 * PAYMENT_GATEWAY), so nothing breaks before the SQL is run.
 */

export type GatewayId = "xyz" | "anuj";
export const GATEWAY_IDS: GatewayId[] = ["xyz", "anuj"];

export const GATEWAY_META: Record<
  GatewayId,
  {
    label: string;
    envKey: string;
    defaultCreateUrl: string;
    defaultVerifyUrl: string;
    needsUtr: boolean;
    description: string;
  }
> = {
  xyz: {
    label: "XYZ (FamPay)",
    envKey: "FP_API_KEY",
    defaultCreateUrl: "https://xyzcheats.com/gateway/create_order.php",
    defaultVerifyUrl: "https://xyzcheats.com/gateway/verify.php",
    needsUtr: true,
    description: "Original gateway. Customer enters the 12-digit UTR to verify.",
  },
  anuj: {
    label: "ANUJ (FamPay)",
    envKey: "ANUJ_API_KEY",
    defaultCreateUrl: "https://gateway.anujbots.in/autoqr.php",
    defaultVerifyUrl: "https://gateway.anujbots.in/autoverify.php",
    needsUtr: false,
    description: "New gateway. No UTR needed: payment is detected automatically from the order ID.",
  },
};

export function isGatewayId(value: unknown): value is GatewayId {
  return value === "xyz" || value === "anuj";
}

/** Orders created before the `gateway` column existed were all created on xyz. */
export function resolveGatewayId(value: unknown): GatewayId {
  return isGatewayId(value) ? value : "xyz";
}

export function gatewayNeedsUtr(id: GatewayId): boolean {
  return GATEWAY_META[id].needsUtr;
}

/* ------------------------------------------------------------------ */
/* settings storage                                                    */
/* ------------------------------------------------------------------ */

const SETTINGS_TABLE = "app_settings";
const ACTIVE_KEY = "payment_gateway_active";
const configKey = (id: GatewayId) => `payment_gateway_config_${id}`;
const CACHE_MS = 5_000;

type StoredConfig = { api_key?: string; create_url?: string; verify_url?: string };

type Snapshot = {
  ready: boolean; // false => app_settings table is missing / unreadable
  active: GatewayId | null;
  configs: Partial<Record<GatewayId, StoredConfig>>;
  at: number;
};

let cache: Snapshot | null = null;

export function invalidateGatewayCache() {
  cache = null;
}

async function loadSettings(force = false): Promise<Snapshot> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache;

  const keys = [ACTIVE_KEY, ...GATEWAY_IDS.map(configKey)];
  const { data, error } = await supabaseAdmin.from(SETTINGS_TABLE).select("key, value").in("key", keys);

  let snap: Snapshot;
  if (error) {
    // Table not created yet (or unreadable): use env defaults.
    snap = { ready: false, active: null, configs: {}, at: Date.now() };
  } else {
    const configs: Partial<Record<GatewayId, StoredConfig>> = {};
    let active: GatewayId | null = null;
    for (const row of data || []) {
      const value = (row as any).value;
      if ((row as any).key === ACTIVE_KEY) {
        if (isGatewayId(value?.gateway)) active = value.gateway;
        continue;
      }
      for (const id of GATEWAY_IDS) {
        if ((row as any).key === configKey(id) && value && typeof value === "object") {
          configs[id] = value as StoredConfig;
        }
      }
    }
    snap = { ready: true, active, configs, at: Date.now() };
  }

  cache = snap;
  return snap;
}

function envDefaultGateway(): GatewayId {
  const fromEnv = String(process.env.PAYMENT_GATEWAY || "").trim().toLowerCase();
  return isGatewayId(fromEnv) ? fromEnv : "xyz";
}

export async function getActiveGatewayId(): Promise<GatewayId> {
  const snap = await loadSettings();
  return snap.active ?? envDefaultGateway();
}

export type GatewayConfig = {
  id: GatewayId;
  apiKey: string;
  createUrl: string;
  verifyUrl: string;
  keySource: "admin" | "env" | "missing";
};

function cleanStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function getGatewayConfig(id: GatewayId, force = false): Promise<GatewayConfig> {
  const snap = await loadSettings(force);
  const meta = GATEWAY_META[id];
  const stored = snap.configs[id] || {};

  const storedKey = cleanStr(stored.api_key);
  const envKey = cleanStr(process.env[meta.envKey]);

  return {
    id,
    apiKey: storedKey || envKey,
    createUrl: cleanStr(stored.create_url) || meta.defaultCreateUrl,
    verifyUrl: cleanStr(stored.verify_url) || meta.defaultVerifyUrl,
    keySource: storedKey ? "admin" : envKey ? "env" : "missing",
  };
}

/* ------------------------------------------------------------------ */
/* HTTP helper                                                         */
/* ------------------------------------------------------------------ */

type HttpResult = { ok: boolean; httpStatus: number; json: any | null; network: boolean };

async function getJson(url: URL): Promise<HttpResult> {
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { ok: res.ok, httpStatus: res.status, json, network: false };
  } catch {
    // Never log the URL: it contains the API key.
    return { ok: false, httpStatus: 0, json: null, network: true };
  }
}

function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* create order                                                        */
/* ------------------------------------------------------------------ */

export type CreatedOrder = {
  order_id: string;
  qr_url: string;
  upi_link: string | null;
  upi_id: string | null;
  amount: number;
  amountText: string;
  created_at: string | null;
  expires_at: string | null;
};

export type CreateResult =
  | { ok: true; order: CreatedOrder }
  | { ok: false; error: string; httpStatus: number };

export async function createGatewayOrder(cfg: GatewayConfig, amount: number): Promise<CreateResult> {
  const url = safeUrl(cfg.createUrl);
  if (!url) return { ok: false, error: "Payment gateway URL is invalid", httpStatus: 500 };

  url.searchParams.set("api_key", cfg.apiKey);
  url.searchParams.set("amount", String(amount));

  const res = await getJson(url);
  if (res.network) return { ok: false, error: "Payment gateway is unreachable. Please try again shortly.", httpStatus: 502 };
  if (!res.json) return { ok: false, error: "Payment gateway returned an invalid response", httpStatus: 502 };

  const body = res.json;
  const data = body?.data;

  if (!res.ok || body?.status !== "success" || !data?.order_id || !data?.qr_url) {
    console.error("GATEWAY CREATE FAILED:", { gateway: cfg.id, http: res.httpStatus, message: String(body?.message || "").slice(0, 160) });
    return { ok: false, error: "Failed to create payment order", httpStatus: 502 };
  }

  const amountNum = Number(data.amount);
  if (!Number.isFinite(amountNum)) {
    return { ok: false, error: "Payment gateway returned an unexpected amount", httpStatus: 502 };
  }

  if (cfg.id === "anuj") {
    const orderId = String(data.order_id);
    const validSeconds = Number(data.valid_seconds);
    const seconds = Number.isFinite(validSeconds) && validSeconds > 0 ? validSeconds : 300;
    const now = Date.now();
    const upiId = data.upi_id ? String(data.upi_id) : null;

    // The gateway gives a QR only; build a tap-to-pay UPI link from the same details.
    const upiLink = upiId
      ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent("JPRIME")}&am=${encodeURIComponent(
          String(data.amount)
        )}&cu=INR&tn=${encodeURIComponent(orderId)}`
      : null;

    return {
      ok: true,
      order: {
        order_id: orderId,
        qr_url: String(data.qr_url),
        upi_link: upiLink,
        upi_id: upiId,
        amount: amountNum,
        amountText: String(data.amount),
        created_at: new Date(now).toISOString(),
        expires_at: new Date(now + seconds * 1000).toISOString(),
      },
    };
  }

  // xyz
  return {
    ok: true,
    order: {
      order_id: String(data.order_id),
      qr_url: String(data.qr_url),
      upi_link: data.upi_link || null,
      upi_id: data.upi_id || null,
      amount: amountNum,
      amountText: String(data.amount),
      created_at: data.created_at || null,
      expires_at: data.expires_at || null,
    },
  };
}

/** The gateway may add paise to make the amount unique; it must never be below the price. */
export function isAmountAcceptable(expected: number, got: number): boolean {
  return Number.isFinite(got) && got >= expected - 0.001 && got < expected + 1;
}

/* ------------------------------------------------------------------ */
/* verify payment                                                      */
/* ------------------------------------------------------------------ */

export type VerifyResult =
  | { state: "paid"; amount: number; utr: string | null; payer: string | null; paymentTime: string | null }
  | { state: "pending" }
  | { state: "expired" }
  | { state: "failed"; message: string; httpStatus: number; gatewayDown: boolean };

export async function verifyGatewayPayment(
  cfg: GatewayConfig,
  input: { orderId: string; utr?: string }
): Promise<VerifyResult> {
  const url = safeUrl(cfg.verifyUrl);
  if (!url) return { state: "failed", message: "Payment gateway URL is invalid", httpStatus: 500, gatewayDown: true };

  url.searchParams.set("order_id", input.orderId);
  url.searchParams.set("api_key", cfg.apiKey);
  if (cfg.id === "xyz") url.searchParams.set("utr", input.utr || "");

  const res = await getJson(url);
  if (res.network) {
    return { state: "failed", message: "Payment gateway is unreachable. Please try again shortly.", httpStatus: 502, gatewayDown: true };
  }
  if (!res.json) {
    console.error("GATEWAY VERIFY INVALID JSON:", { gateway: cfg.id, http: res.httpStatus });
    return { state: "failed", message: "Payment gateway returned invalid data", httpStatus: 502, gatewayDown: true };
  }

  const body = res.json;

  /* ----- anuj ----- */
  if (cfg.id === "anuj") {
    const data = body?.data || {};
    const message = String(body?.message || data?.message || "");
    const code = String(data?.code || "");
    const st = String(data?.status || "").toUpperCase();

    if (code === "SUBSCRIPTION_EXPIRED" || /invalid api_key|api_key is required|subscription expired/i.test(message)) {
      // Operator problem (plan ended / key wrong). Never show details to customers.
      console.error("ANUJ GATEWAY ACCOUNT PROBLEM:", message.slice(0, 160));
      return { state: "failed", message: "Payment gateway is temporarily unavailable. Please try again shortly.", httpStatus: 502, gatewayDown: true };
    }
    if (st === "PAID") {
      return {
        state: "paid",
        amount: Number(data.amount),
        utr: data.utr ? String(data.utr) : null,
        payer: data.payer ? String(data.payer) : null,
        paymentTime: data.payment_time ? String(data.payment_time) : null,
      };
    }
    if (st === "PENDING") return { state: "pending" };
    if (st === "EXPIRED") return { state: "expired" };

    if (/order not found/i.test(message)) {
      return { state: "failed", message: "Payment order not found at the gateway", httpStatus: 404, gatewayDown: false };
    }
    console.error("ANUJ GATEWAY UNEXPECTED VERIFY RESPONSE:", { http: res.httpStatus, message: message.slice(0, 160) });
    return { state: "failed", message: "Unable to verify payment", httpStatus: 502, gatewayDown: false };
  }

  /* ----- xyz (unchanged behaviour) ----- */
  if (body?.status === "pending") return { state: "pending" };

  if (!res.ok || body?.status !== "success" || !body?.data) {
    console.error("XYZ GATEWAY VERIFY FAILED:", { http: res.httpStatus, status: body?.status });
    return {
      state: "failed",
      message: String(body?.message || "Unable to verify payment"),
      httpStatus: 502,
      gatewayDown: false,
    };
  }

  return {
    state: "paid",
    amount: Number(body.data.amount),
    utr: body.data.utr ? String(body.data.utr) : null,
    payer: body.data.sender_name ? String(body.data.sender_name) : null,
    paymentTime: body.data.payment_time ? String(body.data.payment_time) : null,
  };
}

/* ------------------------------------------------------------------ */
/* admin helpers                                                       */
/* ------------------------------------------------------------------ */

function maskKey(key: string): string {
  if (!key) return "";
  return key.length <= 4 ? "••••" : `••••${key.slice(-4)}`;
}

export type GatewayAdminView = {
  storageReady: boolean;
  active: GatewayId;
  activeFrom: "admin" | "env-default";
  gateways: Record<
    GatewayId,
    {
      id: GatewayId;
      label: string;
      description: string;
      needsUtr: boolean;
      createUrl: string;
      verifyUrl: string;
      defaultCreateUrl: string;
      defaultVerifyUrl: string;
      keySource: "admin" | "env" | "missing";
      keyHint: string;
      envKey: string;
    }
  >;
};

export async function getGatewayAdminView(): Promise<GatewayAdminView> {
  const snap = await loadSettings(true);
  const gateways = {} as GatewayAdminView["gateways"];
  for (const id of GATEWAY_IDS) {
    const cfg = await getGatewayConfig(id);
    const meta = GATEWAY_META[id];
    gateways[id] = {
      id,
      label: meta.label,
      description: meta.description,
      needsUtr: meta.needsUtr,
      createUrl: cfg.createUrl,
      verifyUrl: cfg.verifyUrl,
      defaultCreateUrl: meta.defaultCreateUrl,
      defaultVerifyUrl: meta.defaultVerifyUrl,
      keySource: cfg.keySource,
      keyHint: maskKey(cfg.apiKey),
      envKey: meta.envKey,
    };
  }
  return {
    storageReady: snap.ready,
    active: snap.active ?? envDefaultGateway(),
    activeFrom: snap.active ? "admin" : "env-default",
    gateways,
  };
}

const SETUP_HINT = "Settings table not found. Run supabase/PAYMENT_GATEWAY_SWITCH.sql in the Supabase SQL editor first.";

async function writeSetting(key: string, value: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabaseAdmin
    .from(SETTINGS_TABLE)
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) {
    console.error("GATEWAY SETTING WRITE ERROR:", error.message);
    return { ok: false, error: SETUP_HINT };
  }
  invalidateGatewayCache();
  return { ok: true };
}

export async function setActiveGateway(id: GatewayId) {
  return writeSetting(ACTIVE_KEY, { gateway: id });
}

function validateUrl(raw: string): string | null {
  const u = safeUrl(raw);
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  // Block IP literals (private / loopback / metadata addresses).
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return null;
  return u.toString();
}

export async function saveGatewayConfig(
  id: GatewayId,
  input: { apiKey?: string; clearKey?: boolean; createUrl?: string; verifyUrl?: string; resetUrls?: boolean }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const snap = await loadSettings(true);
  const current: StoredConfig = { ...(snap.configs[id] || {}) };

  if (input.resetUrls) {
    delete current.create_url;
    delete current.verify_url;
  } else {
    if (input.createUrl !== undefined) {
      const raw = input.createUrl.trim();
      if (!raw) delete current.create_url;
      else {
        const ok = validateUrl(raw);
        if (!ok) return { ok: false, error: "Create URL must be a public https:// address." };
        current.create_url = ok;
      }
    }
    if (input.verifyUrl !== undefined) {
      const raw = input.verifyUrl.trim();
      if (!raw) delete current.verify_url;
      else {
        const ok = validateUrl(raw);
        if (!ok) return { ok: false, error: "Verify URL must be a public https:// address." };
        current.verify_url = ok;
      }
    }
  }

  if (input.clearKey) {
    delete current.api_key;
  } else if (typeof input.apiKey === "string" && input.apiKey.trim()) {
    const key = input.apiKey.trim();
    if (key.length < 8 || key.length > 200 || /\s/.test(key)) {
      return { ok: false, error: "That API key does not look valid." };
    }
    current.api_key = key;
  }

  return writeSetting(configKey(id), current);
}

/**
 * Safe connectivity test: asks the gateway to look up a fake order. No money moves and no
 * order is created. Tells the admin whether the URL is reachable and the key is accepted.
 */
export async function testGateway(id: GatewayId): Promise<{ ok: boolean; message: string }> {
  const cfg = await getGatewayConfig(id, true);
  if (!cfg.apiKey) return { ok: false, message: `No API key saved. Add one here or set ${GATEWAY_META[id].envKey} in Vercel.` };

  const url = safeUrl(cfg.verifyUrl);
  if (!url) return { ok: false, message: "Verify URL is invalid." };

  url.searchParams.set("order_id", "JPRIME_CONNECTION_TEST");
  url.searchParams.set("api_key", cfg.apiKey);
  if (id === "xyz") url.searchParams.set("utr", "000000000000");

  const res = await getJson(url);
  if (res.network) return { ok: false, message: "Could not reach the gateway (timeout or network error)." };
  if (!res.json) return { ok: false, message: `Gateway answered with HTTP ${res.httpStatus} but not valid JSON.` };

  const message = String(res.json?.message || res.json?.data?.message || "").slice(0, 200);

  if (id === "anuj") {
    if (/invalid api_key|api_key is required/i.test(message)) return { ok: false, message: "Gateway reachable, but the API key was rejected." };
    if (res.json?.data?.code === "SUBSCRIPTION_EXPIRED" || /subscription expired/i.test(message)) {
      return { ok: false, message: `Gateway reachable, but the subscription has ended. ${message}` };
    }
    return { ok: true, message: `Gateway reachable and API key accepted.${message ? ` (${message})` : ""}` };
  }

  return { ok: true, message: `Gateway reachable (HTTP ${res.httpStatus}).${message ? ` Reply: ${message}` : ""}` };
}