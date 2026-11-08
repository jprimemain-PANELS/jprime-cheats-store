/**
 * Pure helpers (no imports, no I/O) shared by the admin Product Manager, the public
 * catalogue, the storefront card, stock counting and purchase routing.
 *
 * Keeping the rules in ONE place is what guarantees that the admin Stock Matrix, the
 * customer stock counter and the real key reservation all agree with each other.
 */

export type Supplier = "LOCAL" | "SELLER1" | "SELLER2";
export type DeliveryMode = "API" | "LOCAL";

type TierLike = {
  supplier?: unknown;
  seller1Pid?: unknown;
  seller1Duration?: unknown;
  sellerDuration?: unknown;
  seller2VariantId?: unknown;
};

type ProductLike = {
  fulfillmentType?: unknown;
  sellerPid?: unknown;
};

const filled = (value: unknown): boolean => String(value ?? "").trim().length > 0;

/* ---------------------------------------------------------------------------
   SUPPLIER ROUTING
   --------------------------------------------------------------------------- */

/** "seller1", "Seller 1", "SELLER_1" -> "SELLER1". Anything unknown -> null (never guessed as LOCAL). */
export function normalizeSupplier(value: unknown): Supplier | null {
  const s = String(value ?? "")
    .toUpperCase()
    .replace(/[\s_-]+/g, "");
  if (s === "SELLER1") return "SELLER1";
  if (s === "SELLER2") return "SELLER2";
  if (s === "LOCAL" || s === "LOCALSTOCK") return "LOCAL";
  return null;
}

export function hasSeller1Config(tier: TierLike, product?: ProductLike): boolean {
  return (
    (filled(tier.seller1Pid) || filled(product?.sellerPid)) &&
    (filled(tier.seller1Duration) || filled(tier.sellerDuration))
  );
}

export function hasSeller2Config(tier: TierLike): boolean {
  return filled(tier.seller2VariantId);
}

/**
 * Best-effort supplier for OLD data that has no explicit `supplier` field
 * (lib/products.ts entries and very old catalogue rows). Used by "Import Existing" and by the
 * legacy purchase fallback only. Returns null when the configuration does not say anything,
 * so callers must treat that as "needs an explicit choice" and NEVER as LOCAL.
 *
 * Both configured: SELLER1 is returned because that is what the old purchase code did
 * (it only ever looked at the product-level sellerPid). Use `isAmbiguousSupplier` to flag it.
 */
export function inferSupplier(tier: TierLike, product?: ProductLike): Supplier | null {
  const s1 = hasSeller1Config(tier, product);
  const s2 = hasSeller2Config(tier);
  if (s1) return "SELLER1";
  if (s2) return "SELLER2";
  if (String(product?.fulfillmentType ?? "").toUpperCase() === "LOCAL") return "LOCAL";
  return null;
}

export function isAmbiguousSupplier(tier: TierLike, product?: ProductLike): boolean {
  return hasSeller1Config(tier, product) && hasSeller2Config(tier);
}

export type SupplierResolution =
  | { ok: true; supplier: Supplier }
  | { ok: false; reason: "missing" | "invalid" };

/**
 * Strict supplier lookup for a catalogue duration at purchase time.
 * Only the explicit `supplier` field counts. Missing/unknown is an error, never LOCAL,
 * so a Seller product can never be silently served from local stock.
 */
export function resolveCatalogSupplier(tier: TierLike): SupplierResolution {
  if (!filled(tier.supplier)) return { ok: false, reason: "missing" };
  const supplier = normalizeSupplier(tier.supplier);
  return supplier ? { ok: true, supplier } : { ok: false, reason: "invalid" };
}

/**
 * Delivery mode of ONE duration: "API" (Seller 1 / Seller 2) or "LOCAL" (stock_keys).
 * Safe to expose publicly: it carries no supplier, product id or variant id.
 */
export function deliveryModeForTier(tier: TierLike, productFulfillmentType?: unknown): DeliveryMode {
  const supplier = normalizeSupplier(tier.supplier);
  if (supplier === "SELLER1" || supplier === "SELLER2") return "API";
  if (supplier === "LOCAL") return "LOCAL";

  // No explicit supplier (old data): read what the configuration says.
  const inferred = inferSupplier(tier, { fulfillmentType: productFulfillmentType });
  if (inferred === "SELLER1" || inferred === "SELLER2") return "API";
  if (inferred === "LOCAL") return "LOCAL";

  // Nothing configured: trust the product-level flag, defaulting to local stock.
  return String(productFulfillmentType ?? "").toUpperCase() === "API" ? "API" : "LOCAL";
}

/** Product-level summary kept for old consumers: "API" only when every duration is API. */
export function summarizeFulfillment(modes: DeliveryMode[]): DeliveryMode {
  return modes.length > 0 && modes.every((mode) => mode === "API") ? "API" : "LOCAL";
}

/* ---------------------------------------------------------------------------
   LOCAL STOCK MATCHING (one rule for admin count, customer count and reservation)
   --------------------------------------------------------------------------- */

/** Case-insensitive, whitespace-insensitive comparison key. Never changes stored data. */
export function normalizeStockText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function stockCountKey(productName: unknown, duration: unknown): string {
  return `${normalizeStockText(productName)}::${normalizeStockText(duration)}`;
}

type StockRowLike = { product_name?: unknown; duration?: unknown; is_used?: unknown };

export function stockRowMatches(row: StockRowLike, productName: unknown, duration: unknown): boolean {
  return (
    normalizeStockText(row.product_name) === normalizeStockText(productName) &&
    normalizeStockText(row.duration) === normalizeStockText(duration)
  );
}

/** Counts UNUSED rows only (is_used must not be true). */
export function countAvailableStock(rows: StockRowLike[], productName: unknown, duration: unknown): number {
  let count = 0;
  for (const row of rows) {
    if (row.is_used === true) continue;
    if (stockRowMatches(row, productName, duration)) count += 1;
  }
  return count;
}

/** One pass over all unused rows -> Map keyed by stockCountKey(product, duration). */
export function buildStockCountMap(rows: StockRowLike[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.is_used === true) continue;
    const key = stockCountKey(row.product_name, row.duration);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}
