import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { readSetting, writeSetting, tdb } from "@/lib/tenant-db";
import { allProducts } from "@/lib/products";
import { OWNER_TENANT_ID } from "@/lib/tenant";
import { deliveryModeForTier } from "@/lib/delivery";
import { normalizeCategory } from "@/lib/categories";
import { countLocalStock } from "@/lib/stock";
import { getTrustedQuote } from "@/lib/pricing";
import { releaseProduct } from "@/lib/release-product";
import { sendTelegramPurchase } from "@/lib/telegram";
import { acquire, creditWallet, debitWallet, getBalance, logWalletTransaction, release } from "@/lib/wallet";

/**
 * RESELLER API: every reseller gets an API key for THEIR store's website (the store they have the account on).
 * Their own bot / website can then list products (with a stable numeric Product ID), check stock, check their wallet and buy keys.
 * Money is taken from the reseller's wallet at the reseller price (VIP prices included); stock comes from the store's own stock or API sellers,
 * exactly like a purchase on the site. Keys are stored only as SHA-256 hashes and are shown once.
 * Three request styles are accepted (see app/api/reseller/compat) so bots written for the common seller APIs connect with just a new base URL + key.
 */
export type ResellerKey = { username: string; hash: string; hint: string; createdAt: string; lastUsed?: string; masterHash?: string; masterHint?: string };
const KEYS = "reseller_api_keys";
const PIDS = "reseller_api_pids";
const MAX_KEYS = 2000;
const FIRST_PID = 1001;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const KEY_RE = /^rk_[a-f0-9]{48}$/;
export const MASTER_RE = /^rm_[a-f0-9]{32}$/;

async function loadKeys(tenantId: string): Promise<ResellerKey[]> {
  const { data, error } = await readSetting(tenantId, KEYS);
  const list = !error && Array.isArray(data?.value) ? data.value : [];
  return list.filter((k: any) => k && typeof k.username === "string" && typeof k.hash === "string");
}
const saveKeys = (tenantId: string, list: ResellerKey[]) => writeSetting(tenantId, KEYS, list);

export async function getKeyInfo(tenantId: string, username: string) {
  const k = (await loadKeys(tenantId)).find((x) => x.username === username);
  return k ? { hasKey: true, hint: k.hint, masterHint: k.masterHint ?? "", createdAt: k.createdAt, lastUsed: k.lastUsed ?? null } : { hasKey: false, hint: "", masterHint: "", createdAt: null, lastUsed: null };
}

/** Creates (or replaces) the user's key. The key is returned ONCE; only its hash is kept. */
export async function generateKey(tenantId: string, username: string): Promise<{ ok: true; key: string; master: string } | { ok: false; error: string }> {
  const list = await loadKeys(tenantId);
  const others = list.filter((k) => k.username !== username);
  if (others.length >= MAX_KEYS) return { ok: false, error: "Too many API keys on this store." };
  const key = `rk_${randomBytes(24).toString("hex")}`;
  const master = `rm_${randomBytes(16).toString("hex")}`;
  const r = await saveKeys(tenantId, [...others, { username, hash: sha(key), hint: `••••${key.slice(-4)}`, masterHash: sha(master), masterHint: `••••${master.slice(-4)}`, createdAt: new Date().toISOString() }]);
  return r.error ? { ok: false, error: "Could not save the key." } : { ok: true, key, master };
}

export async function revokeKey(tenantId: string, username: string) {
  const r = await saveKeys(tenantId, (await loadKeys(tenantId)).filter((k) => k.username !== username));
  return !r.error;
}

/** The reseller who owns this key on THIS store, or null. The account must still have the reseller role. */
export async function resellerFromKey(tenantId: string, raw: unknown): Promise<{ username: string; role: string; masterHash?: string } | null> {
  const k = String(raw ?? "").trim();
  if (!KEY_RE.test(k)) return null;
  const h = Buffer.from(sha(k), "hex");
  let found: ResellerKey | null = null;
  const list = await loadKeys(tenantId);
  for (const x of list) {
    const b = Buffer.from(x.hash, "hex");
    if (b.length === h.length && timingSafeEqual(b, h)) found = x;
  }
  if (!found) return null;
  const u = await tdb(tenantId).from("users").select("username, role").eq("username", found.username).maybeSingle();
  if (u.error || !u.data || String(u.data.role ?? "").trim().toLowerCase() !== "reseller") return null;
  // lastUsed is written at most once an hour per key (keeps writes tiny)
  const last = found.lastUsed ? Date.parse(found.lastUsed) : 0;
  if (Date.now() - last > 3_600_000) {
    found.lastUsed = new Date().toISOString();
    await saveKeys(tenantId, list).catch(() => {});
  }
  return { username: found.username, role: "reseller", masterHash: found.masterHash };
}

/** Master key check for bots that always send one (Style 1). Empty = skipped; a value that is sent must be right. */
export function masterOk(masterHash: string | undefined, given: unknown): boolean {
  const g = String(given ?? "").trim();
  if (!g) return true;
  if (!masterHash || !MASTER_RE.test(g)) return false;
  const a = Buffer.from(sha(g), "hex"), b = Buffer.from(masterHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ---------------- products with stable numeric Product IDs ---------------- */

type PidBook = { next: number; map: Record<string, number> };
const pidKey = (name: string, duration: string) => `${name.trim()}::${duration.trim()}`;

async function assignPids(tenantId: string, keys: string[]): Promise<Record<string, number>> {
  const { data, error } = await readSetting(tenantId, PIDS);
  const book: PidBook = !error && data?.value && typeof data.value === "object" && data.value.map ? { next: Number(data.value.next) || FIRST_PID, map: { ...data.value.map } } : { next: FIRST_PID, map: {} };
  let changed = false;
  for (const k of keys) if (!(k in book.map)) { book.map[k] = book.next++; changed = true; }
  if (changed) await writeSetting(tenantId, PIDS, book);
  return book.map;
}

export type ApiItem = { product_id: number; group_id: number; product: string; duration: string; category: string; price: number; status: "ONLINE" | "MAINTENANCE"; delivery: "instant-api" | "local-stock"; stock: number | null; in_stock: boolean };

async function loadCatalogRows(tenantId: string): Promise<{ name: string; category: string; status: string; tiers: any[]; fulfillmentType: any }[]> {
  const { data, error } = await tdb(tenantId).from("products_catalog").select("name, data");
  const rows: any[] = !error && Array.isArray(data) ? data : [];
  const out = rows.map((r) => {
    const d = r.data && typeof r.data === "object" ? r.data : {};
    return { name: String(d.name || r.name), category: normalizeCategory(d.category) ?? "mobile", status: String(d.status || "").toUpperCase(), tiers: Array.isArray(d.prices) ? d.prices : [], fulfillmentType: d.fulfillmentType, kind: d.kind };
  }).filter((p: any) => p.kind !== "guild");
  if (out.length === 0 && tenantId === OWNER_TENANT_ID) return allProducts.map((p) => ({ name: p.name, category: String(p.category), status: p.status, tiers: p.prices as any[], fulfillmentType: p.fulfillmentType }));
  return out;
}

const rupees = (v: unknown) => { const n = parseFloat(String(v ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(n) ? n : null; };

/** Every product duration the reseller can buy, with THEIR price, a Product ID and stock. */
export async function listItems(tenantId: string, username: string, opts: { fresh?: boolean } = {}): Promise<ApiItem[]> {
  const [cat, prices, vip] = await Promise.all([
    loadCatalogRows(tenantId),
    tdb(tenantId).from("product_prices").select("product_name, duration, price_inr, reseller_price"),
    tdb(tenantId).from("reseller_price_overrides").select("product_name, duration, reseller_price").eq("username", username),
  ]);
  const over = new Map<string, { retail?: number; reseller?: number }>();
  const maint = new Set<string>();
  for (const r of ((prices.data as any[]) ?? [])) {
    const name = String(r.product_name ?? "").trim(); const dur = String(r.duration ?? "").trim();
    if (dur === "__status__") { if (Number(r.price_inr) === 1) maint.add(name); else maint.delete(name); continue; }
    over.set(pidKey(name, dur), { retail: Number.isFinite(Number(r.price_inr)) ? Math.round(Number(r.price_inr)) : undefined, reseller: r.reseller_price != null && Number.isFinite(Number(r.reseller_price)) ? Math.round(Number(r.reseller_price)) : undefined });
  }
  const vipMap = new Map<string, number>();
  for (const r of ((vip.data as any[]) ?? [])) if (Number.isFinite(Number(r.reseller_price))) vipMap.set(pidKey(String(r.product_name ?? ""), String(r.duration ?? "")), Number(r.reseller_price));

  const raw: { p: any; t: any; duration: string }[] = [];
  for (const p of cat) for (const t of p.tiers) { const duration = String(t?.duration ?? "").trim(); if (duration && rupees(t?.priceINR) != null) raw.push({ p, t, duration }); }
  const pids = await assignPids(tenantId, [...raw.map((x) => pidKey(x.p.name, x.duration)), ...Array.from(new Set(raw.map((x) => `group::${x.p.name.trim()}`)))]);

  const items: ApiItem[] = [];
  for (const { p, t, duration } of raw) {
    const k = pidKey(p.name, duration);
    const o = over.get(k);
    const retail = o?.retail ?? rupees(t.priceINR) ?? 0;
    const reseller = o?.reseller ?? (t.resellerPrice != null ? rupees(t.resellerPrice) : null);
    const price = vipMap.get(k) ?? reseller ?? retail;
    const mode = deliveryModeForTier(t ?? {}, p.fulfillmentType);
    let stock: number | null = null;
    if (mode === "LOCAL") { const c = await countLocalStock(tenantId, p.name, duration, { fresh: opts.fresh }); stock = c.ok ? c.data : null; }
    const status = p.status === "MAINTENANCE" || maint.has(p.name) ? "MAINTENANCE" : "ONLINE";
    items.push({ product_id: pids[k], group_id: pids[`group::${p.name.trim()}`], product: p.name, duration, category: p.category, price, status, delivery: mode === "LOCAL" ? "local-stock" : "instant-api", stock, in_stock: status === "ONLINE" && (mode === "API" || (stock ?? 0) > 0) });
  }
  return items.sort((a, b) => a.product_id - b.product_id);
}

/* ---------------- buying ---------------- */

export type BuyResult =
  | { ok: true; key: string; order: string; price: number; balance: number; product: string; duration: string; duplicate?: boolean }
  | { ok: false; status: number; error: string; balance?: number };

const ORD = (u: string) => `reseller_api_orders:${u}`;
type Order = { order: string; idem: string; pid: number; product: string; duration: string; price: number; key: string; at: string };

export async function listOrders(tenantId: string, username: string, limit = 50): Promise<Omit<Order, "idem">[]> {
  const { data } = await readSetting(tenantId, ORD(username));
  const list: Order[] = Array.isArray(data?.value) ? data.value : [];
  return list.slice(0, limit).map(({ idem: _i, ...o }) => o);
}

export async function buyByPid(tenantId: string, username: string, pidRaw: unknown, idemRaw?: unknown): Promise<BuyResult> {
  const pid = Number(pidRaw);
  if (!Number.isInteger(pid) || pid <= 0) return { ok: false, status: 400, error: "product_id must be a number from the products list." };
  const idem = String(idemRaw ?? "").trim();
  if (idem && !/^[A-Za-z0-9_.:-]{6,80}$/.test(idem)) return { ok: false, status: 400, error: "idempotency_key must be 6-80 letters, numbers or - _ . :" };

  const lockKey = `reseller-api:${tenantId}:${username}`;
  if (!acquire(lockKey)) return { ok: false, status: 409, error: "Another purchase is in progress. Try again in a moment." };
  try {
    const { data: ob } = await readSetting(tenantId, ORD(username));
    const orders: Order[] = Array.isArray(ob?.value) ? ob.value : [];
    if (idem) {
      const dup = orders.find((o) => o.idem === idem);
      if (dup) {
        const bal = (await getBalance(tenantId, username)) ?? 0;
        return { ok: true, key: dup.key, order: dup.order, price: dup.price, balance: bal, product: dup.product, duration: dup.duration, duplicate: true };
      }
    }
    const items = await listItems(tenantId, username, { fresh: true });
    const item = items.find((i) => i.product_id === pid);
    if (!item) return { ok: false, status: 404, error: "Unknown product_id." };
    if (item.status === "MAINTENANCE") return { ok: false, status: 409, error: "This product is under maintenance." };
    if (item.delivery === "local-stock" && !(item.stock && item.stock > 0)) return { ok: false, status: 409, error: "Out of stock." };

    const quote = await getTrustedQuote({ tenantId, username, role: "reseller", productName: item.product, duration: item.duration });
    if (!quote.ok) return { ok: false, status: quote.httpStatus, error: quote.error };
    if (quote.status === "MAINTENANCE") return { ok: false, status: 409, error: "This product is under maintenance." };

    const debit = await debitWallet(tenantId, username, quote.price);
    if (!debit.ok) return debit.reason === "insufficient" ? { ok: false, status: 402, error: "Insufficient wallet balance. Add money to your wallet on the website.", balance: (await getBalance(tenantId, username)) ?? 0 } : { ok: false, status: 500, error: "Could not charge the wallet." };
    await logWalletTransaction({ tenantId, username, type: "purchase", amount: quote.price, balance_after: debit.balance, description: `API purchase: ${item.product} (${item.duration})` });

    let key: string | null = null;
    try {
      const d: any = await releaseProduct({ tenantId, username, product_name: item.product, duration: item.duration });
      if (d?.success && typeof d.key === "string" && d.key.trim()) key = d.key.trim();
    } catch (e) { console.error("RESELLER API DELIVERY EXCEPTION:", e instanceof Error ? e.message : "unknown"); }

    if (!key) {
      const back = await creditWallet(tenantId, username, quote.price);
      if (back.ok) {
        await logWalletTransaction({ tenantId, username, type: "refund", amount: quote.price, balance_after: back.balance, description: `Refund (API delivery failed): ${item.product} (${item.duration})` });
        return { ok: false, status: 502, error: "Could not deliver the key right now. You were not charged.", balance: back.balance };
      }
      console.error("RESELLER API REFUND FAILED - MANUAL REVIEW:", { tenantId, username, amount: quote.price });
      return { ok: false, status: 500, error: "Delivery failed and the refund needs support review." };
    }

    const at = new Date().toISOString();
    const order = `RA-${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString("hex").toUpperCase()}`;
    const hist = await tdb(tenantId).from("purchase_history").insert([{ username, product_name: item.product, duration: item.duration, key_code: key, price_paid: String(quote.price), purchased_at: at, created_at: at }]);
    if (hist.error) console.error("PURCHASE HISTORY INSERT FAILED:", hist.error.message);
    await writeSetting(tenantId, ORD(username), [{ order, idem, pid, product: item.product, duration: item.duration, price: quote.price, key, at }, ...orders].slice(0, 200)).catch(() => {});
    try { await sendTelegramPurchase({ username, product: item.product, duration: item.duration, amount: quote.price, method: "Reseller API", reseller: true, key, tenantId }); } catch { /* never loses the key */ }
    return { ok: true, key, order, price: quote.price, balance: debit.balance, product: item.product, duration: item.duration };
  } catch (e) {
    console.error("RESELLER API BUY ERROR:", e instanceof Error ? e.message : "unknown");
    return { ok: false, status: 500, error: "Purchase failed." };
  } finally { release(lockKey); }
}

export const walletBalance = async (tenantId: string, username: string) => (await getBalance(tenantId, username)) ?? 0;
