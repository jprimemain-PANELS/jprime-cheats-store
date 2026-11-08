import {
  deliveryModeForTier,
  hasSeller1Config,
  hasSeller2Config,
  inferSupplier,
  isAmbiguousSupplier,
  normalizeSupplier,
  summarizeFulfillment,
  type Supplier,
} from "@/lib/delivery";

/**
 * Pure catalogue-editing rules used by the admin Product Manager (kept out of the component so
 * they can be unit tested). Nothing here talks to the network or the database.
 */


export interface CatalogTier {
  duration: string;
  priceINR: string;
  resellerPrice?: string;
  priceUSD?: string;
  sellerDuration?: string;

  // "" = not chosen yet. It is NEVER silently treated as LOCAL.
  supplier?: Supplier | "";

  seller1Pid?: string;
  seller1Duration?: string;

  seller2VariantId?: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  category: "mobile" | "pc" | "ios";
  fulfillmentType?: "API" | "LOCAL";
  updateChannel: string;
  features: string[];
  videoPlaceholder?: string;
  videoUrl?: string;
  status: "ONLINE" | "MAINTENANCE";
  prices: CatalogTier[];
}



/**
 * Loads a stored catalogue product into the editor WITHOUT changing its routing.
 *  - every stored field is kept (the spread), including ones this screen does not edit
 *  - a missing / unrecognised supplier becomes "" (not chosen), never "LOCAL"
 *  - a missing supplier is only pre-filled when the stored config clearly says which one
 *    (exactly one of Seller 1 / Seller 2 configured); ambiguous or empty stays "not chosen"
 */
export function normalizeProduct(product: any): CatalogProduct {
  const fulfillmentType =
    product.fulfillmentType === "API" || product.fulfillmentType === "LOCAL"
      ? product.fulfillmentType
      : undefined;

  return {
    ...product,
    id: String(product.id || ""),
    name: String(product.name || ""),
    category: product.category || "mobile",
    fulfillmentType,
    updateChannel: String(product.updateChannel || ""),
    features:
      Array.isArray(product.features) && product.features.length
        ? product.features
        : [""],
    videoPlaceholder: String(product.videoPlaceholder || ""),
    videoUrl: String(product.videoUrl || ""),
    status: product.status === "MAINTENANCE" ? "MAINTENANCE" : "ONLINE",

    prices:
      Array.isArray(product.prices) && product.prices.length
        ? product.prices.map((tier: any) => {
            const explicit = normalizeSupplier(tier.supplier);
            const detected = explicit
              ? null
              : isAmbiguousSupplier(tier, product)
              ? null
              : inferSupplier(tier, product);

            return {
              ...tier,
              duration: String(tier.duration || ""),
              priceINR: String(tier.priceINR || ""),
              resellerPrice: String(tier.resellerPrice || ""),
              priceUSD: String(tier.priceUSD || ""),
              sellerDuration: String(tier.sellerDuration || ""),

              supplier: explicit ?? detected ?? "",

              seller1Pid: String(tier.seller1Pid || ""),
              seller1Duration: String(
                tier.seller1Duration || tier.sellerDuration || ""
              ),

              seller2VariantId: String(tier.seller2VariantId || ""),
            };
          })
        : [],
  };
}

/** Plain-language routing problems for one product (shown in the list and before saving). */
export function routingProblems(product: CatalogProduct): string[] {
  const problems: string[] = [];

  for (const tier of product.prices) {
    if (!String(tier.duration || "").trim()) continue;
    const label = `"${String(tier.duration).trim()}"`;
    const supplier = normalizeSupplier(tier.supplier);

    if (!supplier) {
      problems.push(`${label}: no supplier chosen.`);
    } else if (supplier === "SELLER1") {
      if (!String(tier.seller1Pid || "").trim()) problems.push(`${label}: Seller 1 product ID is empty.`);
      if (!String(tier.seller1Duration || "").trim()) problems.push(`${label}: Seller 1 duration is empty.`);
    } else if (supplier === "SELLER2") {
      if (!String(tier.seller2VariantId || "").trim()) problems.push(`${label}: Seller 2 variant ID is empty.`);
    } else if (supplier === "LOCAL" && (hasSeller1Config(tier) || hasSeller2Config(tier))) {
      problems.push(`${label}: set to LOCAL but has Seller IDs saved. Check this is intended.`);
    }
  }

  return problems;
}

/**
 * Converts a built-in (lib/products.ts) product to a catalogue product from what it REALLY has
 * configured, instead of assuming "API means Seller 1".
 */
export function legacyToCatalogProduct(product: any, notes: string[]): CatalogProduct {
  const base = normalizeProduct(product);
  const sourceTiers: any[] = Array.isArray(product.prices) ? product.prices : [];
  let unresolved = false;

  base.prices = base.prices.map((tier) => {
    const source =
      sourceTiers.find(
        (t) => String(t?.duration ?? "").trim() === String(tier.duration).trim()
      ) || {};

    const config = {
      seller1Pid: product.sellerPid,
      sellerDuration: source.sellerDuration,
      seller2VariantId: source.seller2VariantId,
    };
    const context = { fulfillmentType: product.fulfillmentType, sellerPid: product.sellerPid };
    const supplier = inferSupplier(config, context);

    if (!supplier) {
      unresolved = true;
      notes.push(`${base.name} / ${tier.duration}: no supplier configuration found. Choose a supplier in Product Manager.`);
    } else if (isAmbiguousSupplier(config, context)) {
      notes.push(`${base.name} / ${tier.duration}: Seller 1 AND Seller 2 are both configured. Imported as Seller 1 (what the old purchase code used). Please confirm.`);
    }

    return {
      ...tier,
      supplier: supplier ?? "",
      seller1Pid: product.sellerPid ? String(product.sellerPid) : "",
      seller1Duration: source.sellerDuration ? String(source.sellerDuration) : "",
      seller2VariantId:
        source.seller2VariantId != null ? String(source.seller2VariantId) : "",
    };
  });

  base.fulfillmentType = summarizeFulfillment(
    base.prices.map((t) => deliveryModeForTier(t, product.fulfillmentType))
  );

  // A product whose supplier could not be determined must not be sold until someone chooses one.
  if (unresolved) base.status = "MAINTENANCE";

  return base;
}

