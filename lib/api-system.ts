import { supabaseAdmin } from "@/lib/supabase-admin";
import { OWNER_TENANT_ID, tdb } from "@/lib/tenant-db";
import { allProducts } from "@/lib/products";
import { resolveCatalogSupplier, inferSupplier, deliveryModeForTier } from "@/lib/delivery";

/** Where an OWNER tier gets its keys: one of the two sellers, or the owner's local key stock. */
function sourceOf(tier: any, data: any): "SELLER1" | "SELLER2" | "LOCAL" | null {
  if (deliveryModeForTier(tier, data?.fulfillmentType) === "LOCAL") {
    const r = resolveCatalogSupplier(tier);
    if (r.ok && r.supplier !== "LOCAL") return r.supplier === "SELLER1" || r.supplier === "SELLER2" ? r.supplier : null;
    return "LOCAL";
  }
  return apiSupplierOf(tier);
}

/** Explicit supplier, or (old data) the one the configuration implies. Only API suppliers count. */
function apiSupplierOf(tier: any): "SELLER1" | "SELLER2" | null {
  const r = resolveCatalogSupplier(tier);
  const s = r.ok ? r.supplier : inferSupplier(tier);
  return s === "SELLER1" || s === "SELLER2" ? s : null;
}
import { cleanProductText } from "@/lib/text-clean";
import type { Tenant } from "@/lib/tenant";

/**
 * API SYSTEM: how a co-admin store gets stock.
 *  - JPRIME API stock: the store sells one of the OWNER's API products; the owner's reseller price is
 *    taken from the store's wallet (the reseller wallet on the main site) at the moment of each sale.
 *  - Own seller account: the store uses its OWN key on one of the owner's integrated sellers.
 *  - New API: the store asks, the owner develops it later.
 * Server only. Keys are never returned to a co-admin browser (masked hint only).
 * Needs supabase/tenant/006_API_SYSTEM.sql; before that every function reports "not available".
 */

export const SELLERS = {
  SELLER1: { name: "bb team admin" },
  SELLER2: { name: "whitex seller hub" },
} as const;
export type SellerId = keyof typeof SELLERS;
export const isSellerId = (v: unknown): v is SellerId => v === "SELLER1" || v === "SELLER2";

export const sellerName = (v: unknown): string | null => (isSellerId(v) ? SELLERS[v].name : null);
const MAX_CONNECTIONS = 8;
const MAX_PENDING = 3;
type Actor = { id: string | number | null; username: string };

const hint = (k: unknown) => { const s = String(k ?? ""); return s ? `••••${s.slice(-4)}` : ""; };
const tableMissing = (e: any) => !!e && /tenant_api_connections|does not exist|schema cache/i.test(String(e.message ?? e));
const ctrl = new RegExp("[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\u2028\\u2029\\ufeff]");

function cleanSecret(v: unknown, label: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const s = String(v ?? "").trim();
  if (!s) return { ok: true, value: null };
  if (s.length > 500 || ctrl.test(s) || /\s/.test(s)) return { ok: false, error: `${label} looks wrong (no spaces, max 500 characters).` };
  return { ok: true, value: s };
}
function cleanUrl(v: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  const s = String(v ?? "").trim();
  if (!s) return { ok: true, value: null };
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || u.username || u.password || s.length > 300) throw new Error();
    return { ok: true, value: u.toString() };
  } catch { return { ok: false, error: "Endpoint URL must be a full https:// link." }; }
}

/** What a co-admin may see about their own connections (keys masked). */
export async function listConnections(tenantId: string) {
  const r = await supabaseAdmin.from("tenant_api_connections")
    .select("id, kind, seller_name, endpoint_url, api_key, master_key, notes, status, assigned_seller, owner_note, created_at")
    .eq("tenant_id", tenantId).order("created_at", { ascending: false });
  if (r.error) return { available: false as const, items: [] as any[] };
  return {
    available: true as const,
    items: ((r.data as any[]) ?? []).map((c) => ({
      id: c.id, kind: c.kind, sellerName: c.seller_name, endpointUrl: c.endpoint_url ?? "", status: c.status,
      assignedSeller: c.assigned_seller ?? null, assignedName: sellerName(c.assigned_seller),
      ownerNote: c.owner_note ?? "", createdAt: c.created_at, hasKey: !!c.api_key, keyHint: hint(c.api_key), hasMaster: !!c.master_key, masterHint: hint(c.master_key),
      notesLength: String(c.notes ?? "").length,
    })),
  };
}

export async function createConnection(tenant: Tenant, actor: Actor, input: any) {
  if (tenant.kind !== "coadmin" || tenant.status !== "active") return { ok: false as const, error: "Your store is not active." };
  const kind = input?.kind === "own_api" ? "own_api" : input?.kind === "other_seller" ? "other_seller" : null;
  if (!kind) return { ok: false as const, error: "Choose who the API belongs to." };
  const name = cleanProductText(input?.sellerName, 60);
  if (name.length < 2) return { ok: false as const, error: kind === "own_api" ? "Enter a name for your API." : "Enter the seller name." };
  const key = cleanSecret(input?.apiKey, "API key"); if (!key.ok) return key;
  const master = cleanSecret(input?.masterKey, "Master key"); if (!master.ok) return master;
  const url = cleanUrl(input?.endpointUrl); if (!url.ok) return url;
  const notes = String(input?.notes ?? "").replace(/\u0000/g, "").slice(0, 8000);
  if (!url.value && !notes.trim()) return { ok: false as const, error: "Add the endpoint URL or paste the API details so the platform team can build it." };

  const cur = await supabaseAdmin.from("tenant_api_connections").select("id, status").eq("tenant_id", tenant.id);
  if (cur.error) return { ok: false as const, error: tableMissing(cur.error) ? "The API system is not switched on yet." : "Could not save." };
  const rows = (cur.data as any[]) ?? [];
  if (rows.length >= MAX_CONNECTIONS) return { ok: false as const, error: "You reached the limit. Remove one you do not need." };
  if (rows.filter((x) => x.status === "pending").length >= MAX_PENDING) return { ok: false as const, error: "You already have requests waiting. Please wait for the answer." };

  const ins = await supabaseAdmin.from("tenant_api_connections").insert({
    tenant_id: tenant.id, kind, seller_name: name, endpoint_url: url.value, api_key: key.value, master_key: master.value, notes: notes || null, status: "pending",
  });
  if (ins.error) return { ok: false as const, error: "Could not save." };
  await supabaseAdmin.from("audit_log").insert({ tenant_id: tenant.id, actor_user_id: String(actor.id ?? ""), actor_username: actor.username, action: "api.requested", target: name });
  return { ok: true as const };
}

/** The store adds / replaces ITS OWN keys (used for an approved seller, or to fix a typo). */
export async function updateConnectionKeys(tenant: Tenant, actor: Actor, id: string, input: any) {
  const row = await supabaseAdmin.from("tenant_api_connections").select("id, status").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
  if (row.error || !row.data) return { ok: false as const, error: "Not found." };
  if ((row.data as any).status === "rejected") return { ok: false as const, error: "This request was rejected." };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (String(input?.apiKey ?? "").trim()) { const k = cleanSecret(input.apiKey, "API key"); if (!k.ok) return k; patch.api_key = k.value; }
  if (String(input?.masterKey ?? "").trim()) { const k = cleanSecret(input.masterKey, "Master key"); if (!k.ok) return k; patch.master_key = k.value; }
  if (input?.clearMaster === true) patch.master_key = null;
  if (Object.keys(patch).length === 1) return { ok: false as const, error: "Nothing to save." };
  const up = await supabaseAdmin.from("tenant_api_connections").update(patch).eq("id", id).eq("tenant_id", tenant.id);
  if (up.error) return { ok: false as const, error: "Could not save." };
  await supabaseAdmin.from("audit_log").insert({ tenant_id: tenant.id, actor_user_id: String(actor.id ?? ""), actor_username: actor.username, action: "api.keys_updated", target: id });
  return { ok: true as const };
}

export async function deleteConnection(tenant: Tenant, actor: Actor, id: string) {
  const d = await supabaseAdmin.from("tenant_api_connections").delete().eq("id", id).eq("tenant_id", tenant.id);
  if (d.error) return { ok: false as const, error: "Could not remove." };
  await supabaseAdmin.from("audit_log").insert({ tenant_id: tenant.id, actor_user_id: String(actor.id ?? ""), actor_username: actor.username, action: "api.removed", target: id });
  return { ok: true as const };
}

/* ------------------------------- owner side ------------------------------- */

export async function ownerListConnections() {
  const [c, t] = await Promise.all([
    supabaseAdmin.from("tenant_api_connections").select("id, tenant_id, kind, seller_name, endpoint_url, api_key, master_key, notes, status, assigned_seller, owner_note, created_at").order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("tenants").select("id, slug, brand_name").neq("kind", "owner"),
  ]);
  if (c.error) return { available: false as const, items: [] as any[] };
  const names = new Map(((t.data as any[]) ?? []).map((x) => [x.id, x.brand_name || x.slug]));
  return {
    available: true as const,
    items: ((c.data as any[]) ?? []).map((x) => ({
      id: x.id, tenantId: x.tenant_id, store: names.get(x.tenant_id) ?? "store", kind: x.kind, sellerName: x.seller_name, endpointUrl: x.endpoint_url ?? "",
      apiKey: x.api_key ?? "", masterKey: x.master_key ?? "", notes: x.notes ?? "", status: x.status, assignedSeller: x.assigned_seller ?? null, ownerNote: x.owner_note ?? "", createdAt: x.created_at,
    })),
  };
}

export async function ownerDecide(id: string, decision: unknown, assignedSeller: unknown, note: unknown, actor: Actor) {
  const d = String(decision);
  if (!["approve", "in_development", "reject"].includes(d)) return { ok: false as const, error: "Unknown decision." };
  const patch: Record<string, unknown> = { decided_at: new Date().toISOString(), updated_at: new Date().toISOString(), owner_note: String(note ?? "").slice(0, 500) || null };
  if (d === "approve") {
    if (!isSellerId(assignedSeller)) return { ok: false as const, error: "Pick which seller this store will use (bb team admin or whitex seller hub)." };
    const cur = await supabaseAdmin.from("tenant_api_connections").select("tenant_id").eq("id", id).maybeSingle();
    if (!cur.data) return { ok: false as const, error: "Not found." };
    const dup = await supabaseAdmin.from("tenant_api_connections").select("id").eq("tenant_id", (cur.data as any).tenant_id).eq("status", "approved").eq("assigned_seller", assignedSeller);
    if (((dup.data as any[]) ?? []).some((x) => x.id !== id)) return { ok: false as const, error: "That store already has this seller approved." };
    patch.status = "approved"; patch.assigned_seller = assignedSeller;
  } else if (d === "in_development") { patch.status = "in_development"; patch.assigned_seller = null; }
  else { patch.status = "rejected"; patch.assigned_seller = null; }
  const r = await supabaseAdmin.from("tenant_api_connections").update(patch).eq("id", id).select("tenant_id").maybeSingle();
  if (r.error) return { ok: false as const, error: /uidx|unique|duplicate/i.test(r.error.message ?? "") ? "That store already has this seller approved." : "Could not save." };
  if (!r.data) return { ok: false as const, error: "Not found." };
  await supabaseAdmin.from("audit_log").insert({ tenant_id: (r.data as any).tenant_id, actor_user_id: String(actor.id ?? ""), actor_username: actor.username, action: `api.${d}`, target: `${id}${isSellerId(assignedSeller) ? ` ${assignedSeller}` : ""}` });
  return { ok: true as const };
}

/* ------------------------- used by the purchase path ------------------------- */

/** The store's OWN key for one of the owner's sellers. null = not approved / no key (never falls back to the owner's keys). */
export async function sellerCredsForTenant(tenantId: string, seller: SellerId): Promise<{ apiKey: string; masterKey: string } | null> {
  if (tenantId === OWNER_TENANT_ID) return null;
  const r = await supabaseAdmin.from("tenant_api_connections").select("api_key, master_key")
    .eq("tenant_id", tenantId).eq("status", "approved").eq("assigned_seller", seller).maybeSingle();
  const row: any = r.data;
  if (r.error || !row?.api_key) return null;
  return { apiKey: String(row.api_key), masterKey: String(row.master_key ?? "") };
}

/** Sellers this store may use with its own key (for the product form). */
export async function approvedSellers(tenantId: string): Promise<{ seller: SellerId; name: string; keyReady: boolean }[]> {
  const r = await supabaseAdmin.from("tenant_api_connections").select("assigned_seller, api_key").eq("tenant_id", tenantId).eq("status", "approved");
  if (r.error) return [];
  return ((r.data as any[]) ?? []).filter((x) => isSellerId(x.assigned_seller)).map((x) => ({ seller: x.assigned_seller as SellerId, name: sellerName(x.assigned_seller) ?? "", keyReady: !!x.api_key }));
}

/** JPRIME API stock: allowed only when the owner switched "Shared stock" on AND a wallet user is linked. */
export async function jprimeAccess(tenantId: string): Promise<{ allowed: boolean; payer: string | null }> {
  if (tenantId === OWNER_TENANT_ID) return { allowed: false, payer: null };
  const r = await supabaseAdmin.from("tenants").select("shared_stock_allowed, payer_username, status, kind").eq("id", tenantId).maybeSingle();
  const row: any = r.data;
  if (r.error || !row || row.kind !== "coadmin") return { allowed: false, payer: null };
  const payer = String(row.payer_username ?? "").trim();
  return { allowed: row.status === "active" && !!payer, payer: payer || null };
}

const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : 0; };

/** One owner tier by (product id, duration): cost = the owner's reseller price. */
type OwnerProduct = { productId: string; name: string; category: string; data: any };

/**
 * ALL of the owner's products: the saved catalogue plus the built-in products that were never imported,
 * with the owner's current price overrides (product_prices) applied, so the cost is the price the owner really uses.
 */
async function ownerProducts(): Promise<OwnerProduct[]> {
  const [cat, ov] = await Promise.all([
    tdb(OWNER_TENANT_ID).from("products_catalog").select("product_id, name, data"),
    tdb(OWNER_TENANT_ID).from("product_prices").select("product_name, duration, price_inr, reseller_price").limit(5000),
  ]);
  if (cat.error) return [];
  const over = new Map<string, { retail: number | null; reseller: number | null }>();
  const maint = new Set<string>();
  for (const o of ((ov.data as any[]) ?? [])) {
    const name = String(o.product_name ?? "").trim();
    if (String(o.duration) === "__status__") { if (Number(o.price_inr) === 1) maint.add(name); continue; }
    over.set(`${name}|${String(o.duration ?? "").trim()}`, { retail: Number(o.price_inr) > 0 ? Number(o.price_inr) : null, reseller: Number(o.reseller_price) > 0 ? Number(o.reseller_price) : null });
  }
  const list: OwnerProduct[] = [];
  const seen = new Set<string>();
  for (const row of ((cat.data as any[]) ?? [])) {
    const data = row.data && typeof row.data === "object" ? row.data : {};
    const name = String(row.name ?? data.name ?? row.product_id).trim();
    seen.add(name);
    list.push({ productId: String(row.product_id), name, category: String(data.category ?? "mobile"), data });
  }
  for (const p of list.length ? [] : allProducts) {
    const name = String(p.name).trim();
    if (seen.has(name)) continue;
    list.push({
      productId: String(p.id), name, category: String(p.category),
      data: {
        status: p.status, fulfillmentType: p.fulfillmentType,
        prices: (p.prices ?? []).map((t: any) => ({
          duration: t.duration, priceINR: t.priceINR, resellerPrice: t.resellerPrice,
          seller1Pid: p.sellerPid !== undefined ? String(p.sellerPid) : "", seller1Duration: t.sellerDuration ?? "",
          seller2VariantId: t.seller2VariantId !== undefined ? String(t.seller2VariantId) : "",
        })),
      },
    });
  }
  return list.map((p) => {
    const prices = (Array.isArray(p.data.prices) ? p.data.prices : []).map((t: any) => {
      const o = over.get(`${p.name}|${String(t?.duration ?? "").trim()}`);
      return o ? { ...t, ...(o.retail ? { priceINR: String(o.retail) } : {}), ...(o.reseller ? { resellerPrice: String(o.reseller) } : {}) } : t;
    });
    return { ...p, data: { ...p.data, status: maint.has(p.name) ? "MAINTENANCE" : p.data.status, prices } };
  });
}

/**
 * What the PAYER account would pay for this product on the main website - the same rule the main site uses
 * (customer = retail price; reseller = reseller price; VIP reseller = their personal price, if the owner set one).
 */
export type PayerPricing = { reseller: boolean; overrides: Map<string, number> };
const DEFAULT_PRICING: PayerPricing = { reseller: true, overrides: new Map() };

export async function payerPricing(payer: string | null | undefined): Promise<PayerPricing> {
  const u = String(payer ?? "").trim();
  if (!u) return DEFAULT_PRICING;
  const [usr, ov] = await Promise.all([
    tdb(OWNER_TENANT_ID).from("users").select("role").eq("username", u).maybeSingle(),
    tdb(OWNER_TENANT_ID).from("reseller_price_overrides").select("product_name, duration, reseller_price").eq("username", u),
  ]);
  const role = String((usr.data as any)?.role ?? "user").trim().toLowerCase();
  const overrides = new Map<string, number>();
  for (const r of (ov.data || []) as any[]) {
    const n = Number(r.reseller_price);
    if (Number.isFinite(n) && n > 0) overrides.set(`${String(r.product_name ?? "").trim()}|${String(r.duration ?? "").trim()}`, n);
  }
  return { reseller: role.includes("reseller") || role === "vip", overrides };
}

function costFor(productName: string, t: any, pr: PayerPricing): number {
  const own = pr.overrides.get(`${productName}|${String(t?.duration ?? "").trim()}`);
  if (own) return own;
  return pr.reseller ? num(t?.resellerPrice) || num(t?.priceINR) : num(t?.priceINR);
}

function tiersOf(p: OwnerProduct, pr: PayerPricing = DEFAULT_PRICING) {
  const tiers: { duration: string; cost: number; price: number }[] = [];
  for (const t of Array.isArray(p.data.prices) ? p.data.prices : []) {
    const s = sourceOf(t, p.data);
    const cost = costFor(p.name, t, pr);
    if (s && cost > 0 && String(t?.duration ?? "").trim()) tiers.push({ duration: String(t.duration).trim(), cost, price: num(t?.priceINR) || cost });
  }
  return tiers;
}

export async function jprimeSource(productId: unknown, duration: unknown, payer?: string | null) {
  const pid = String(productId ?? "").trim(); const dur = String(duration ?? "").trim();
  if (!pid || !dur) return { ok: false as const };
  const row = (await ownerProducts()).find((p) => p.productId === pid);
  // Owner maintenance does NOT stop a co-admin's JPRIME delivery: the co-admin controls their own product status.
  if (!row) return { ok: false as const };
  const tier = (Array.isArray(row.data.prices) ? row.data.prices : []).find((t: any) => String(t?.duration ?? "").trim() === dur);
  if (!tier) return { ok: false as const };
  const sup = sourceOf(tier, row.data);
  if (!sup) return { ok: false as const };
  const cost = costFor(row.name, tier, await payerPricing(payer));
  if (!(cost > 0)) return { ok: false as const };
  return { ok: true as const, cost, supplier: sup, tier: { ...tier, supplier: sup }, productName: row.name, productId: pid, duration: dur };
}

/** "productId|duration" pairs the owner still sells through JPRIME (used to hide co-admin copies of deleted owner products). */
export async function jprimeLiveSources(): Promise<Set<string>> {
  const live = new Set<string>();
  for (const p of await ownerProducts()) {
    for (const t of tiersOf(p)) live.add(`${p.productId}|${t.duration}`);
  }
  return live;
}

/** Owner only: products co-admins cannot pick, and exactly why (so nothing is a mystery). */
export async function jprimeHidden() {
  const out: { name: string; reason: string }[] = [];
  for (const p of await ownerProducts()) {
    if (tiersOf(p).length) continue;
    const prices: any[] = Array.isArray(p.data.prices) ? p.data.prices : [];
    if (!prices.length) { out.push({ name: p.name, reason: "No durations/prices saved." }); continue; }
    const t = prices.find((x) => String(x?.duration ?? "").trim());
    if (!t) out.push({ name: p.name, reason: "Durations have no name." });
    else if (!(num(t.resellerPrice) || num(t.priceINR))) out.push({ name: p.name, reason: "Price is missing or 0." });
    else out.push({ name: p.name, reason: "No delivery set: open it in Products and choose Local Stock or a Seller for each duration." });
  }
  return out;
}

/** What a co-admin may pick: names, durations and THEIR cost. Never supplier ids. */
export async function jprimeCatalog(payer?: string | null) {
  const out: any[] = [];
  const pr = await payerPricing(payer);
  for (const p of await ownerProducts()) {
    const tiers = tiersOf(p, pr);
    if (tiers.length) out.push({ productId: p.productId, name: p.name, category: p.category, tiers });
  }
  return out;
}

/**
 * Server-side rules for the tiers a CO-ADMIN may save (the form is only a convenience).
 * Mutates the product: strips supplier fields that do not belong to the chosen supplier.
 */
export async function guardStoreTiers(tenantId: string, product: any): Promise<{ ok: true } | { ok: false; error: string }> {
  const tiers: any[] = Array.isArray(product?.prices) ? product.prices : [];
  let access: { allowed: boolean; payer: string | null } | null = null;
  let sellers: Awaited<ReturnType<typeof approvedSellers>> | null = null;
  let jprimeSourceId = "";

  for (const t of tiers) {
    if (!t) continue;
    const sup = String(t.supplier ?? "").trim() ? normalizeSupplierLoose(t.supplier) : "";
    if (sup === null) return { ok: false, error: "Unknown supplier." };
    if (sup === "" || sup === "LOCAL") {
      for (const k of ["seller1Pid", "seller1Duration", "seller2VariantId", "jprimeProductId", "jprimeDuration"]) delete t[k];
      continue;
    }
    if (sup === "JPRIME") {
      access ??= await jprimeAccess(tenantId);
      if (!access.allowed) return { ok: false, error: "JPRIME API stock is not enabled for your store. Ask the platform owner." };
      const src = await jprimeSource(t.jprimeProductId, t.jprimeDuration);
      if (!src.ok) return { ok: false, error: `"${t.duration}": the chosen JPRIME product or duration is not available.` };
      if (jprimeSourceId && jprimeSourceId !== src.productId) return { ok: false, error: "One product can use only one JPRIME product. Create another product for a different one." };
      jprimeSourceId = src.productId;
      t.supplier = "JPRIME"; t.jprimeProductId = src.productId; t.jprimeDuration = src.duration;
      for (const k of ["seller1Pid", "seller1Duration", "seller2VariantId", "sellerDuration"]) delete t[k];
      continue;
    }
    // SELLER1 / SELLER2 with the store's own key: only a seller it was approved for
    sellers ??= await approvedSellers(tenantId);
    if (!sellers.some((x) => x.seller === sup)) return { ok: false, error: `You are not approved for ${sup === "SELLER1" ? SELLERS.SELLER1.name : SELLERS.SELLER2.name}. Request it on the API SYSTEM page.` };
    delete t.jprimeProductId; delete t.jprimeDuration;
  }
  if (jprimeSourceId) {
    const pid = String(product.id ?? "").trim();
    if (pid && pid !== jprimeSourceId) return { ok: false, error: `Product ID must stay "${jprimeSourceId}" for JPRIME API stock.` };
    product.id = jprimeSourceId;
    // Blank video / features = use the JPRIME ones (copied once at save; only plain text values)
    const needVideo = !String(product.videoUrl ?? "").trim();
    const feats: any[] = Array.isArray(product.features) ? product.features : [];
    const needFeatures = !feats.some((f) => String(f ?? "").trim());
    if (needVideo || needFeatures) {
      const o = await tdb(OWNER_TENANT_ID).from("products_catalog").select("data").eq("product_id", jprimeSourceId).maybeSingle();
      const od: any = (o.data as any)?.data ?? (allProducts.find((x) => x.id === jprimeSourceId) as any);
      if (od && typeof od === "object") {
        if (needVideo && typeof od.videoUrl === "string") product.videoUrl = od.videoUrl;
        if (needFeatures && Array.isArray(od.features)) product.features = od.features.filter((f: any) => typeof f === "string");
      }
    }
  }
  return { ok: true };
}
function normalizeSupplierLoose(v: unknown): "LOCAL" | "SELLER1" | "SELLER2" | "JPRIME" | null {
  const s = String(v ?? "").toUpperCase().replace(/[\s_-]+/g, "");
  if (s === "LOCAL" || s === "LOCALSTOCK") return "LOCAL";
  if (s === "SELLER1" || s === "SELLER2" || s === "JPRIME") return s as any;
  return null;
}
