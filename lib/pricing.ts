import { supabaseAdmin } from "@/lib/supabase-admin";
import { allProducts } from "@/lib/products";

/**
 * Trusted, server-side price + status resolution.
 * Mirrors what the storefront displays so customers pay exactly what they see,
 * but never trusts any price/amount sent by the browser.
 *
 * Order: catalog (or lib/products.ts fallback) -> product_prices override
 * -> reseller VIP override (resellers only) -> reseller price, else retail.
 */

const STATUS_ROW = "__status__";

export type TrustedQuote =
  | {
      ok: true;
      price: number;
      status: "ONLINE" | "MAINTENANCE";
      fulfillmentType: "API" | "LOCAL" | null;
    }
  | { ok: false; error: string; httpStatus: number };

function parseRupees(value: unknown): number | null {
  const n = parseFloat(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

type Tier = { duration: string; priceINR: unknown; resellerPrice?: unknown };

async function loadProduct(productName: string): Promise<{
  tiers: Tier[];
  status: "ONLINE" | "MAINTENANCE";
  fulfillmentType: "API" | "LOCAL" | null;
} | null> {
  const { data, error } = await supabaseAdmin
    .from("products_catalog")
    .select("name, data")
    .eq("name", productName)
    .maybeSingle();

  if (!error && data) {
    const d: any = data.data && typeof data.data === "object" ? data.data : {};
    return {
      tiers: Array.isArray(d.prices) ? d.prices : [],
      status: String(d.status || "").toUpperCase() === "MAINTENANCE" ? "MAINTENANCE" : "ONLINE",
      fulfillmentType:
        d.fulfillmentType === "API" || d.fulfillmentType === "LOCAL" ? d.fulfillmentType : null,
    };
  }

  // Legacy fallback (same behaviour as the storefront / release-product).
  const legacy = allProducts.find((p) => p.name === productName);
  if (!legacy) return null;
  return {
    tiers: legacy.prices,
    status: legacy.status,
    fulfillmentType: legacy.fulfillmentType ?? null,
  };
}

export async function getTrustedQuote(params: {
  username: string;
  role: string;
  productName: string;
  duration: string;
}): Promise<TrustedQuote> {
  const productName = String(params.productName || "").trim();
  const duration = String(params.duration || "").trim();

  if (!productName || !duration || duration === STATUS_ROW) {
    return { ok: false, error: "Invalid product.", httpStatus: 400 };
  }

  const product = await loadProduct(productName);
  if (!product) return { ok: false, error: "Product not found.", httpStatus: 404 };

  const tier = product.tiers.find((t) => String(t?.duration ?? "").trim() === duration);
  if (!tier) return { ok: false, error: "Duration not available.", httpStatus: 404 };

  let retail = parseRupees(tier.priceINR);
  let reseller = tier.resellerPrice != null ? parseRupees(tier.resellerPrice) : null;
  let status = product.status;

  const { data: rows, error: rowsError } = await supabaseAdmin
    .from("product_prices")
    .select("duration, price_inr, reseller_price")
    .eq("product_name", productName);

  if (rowsError) {
    console.error("PRICE OVERRIDE LOOKUP ERROR:", rowsError.message);
    return { ok: false, error: "Could not verify price.", httpStatus: 503 };
  }

  for (const row of (rows || []) as any[]) {
    if (row.duration === STATUS_ROW) {
      status = Number(row.price_inr) === 1 ? "MAINTENANCE" : "ONLINE";
      continue;
    }
    if (row.duration === duration) {
      const p = Number(row.price_inr);
      if (Number.isFinite(p)) retail = Math.round(p);
      if (row.reseller_price != null && Number.isFinite(Number(row.reseller_price))) {
        reseller = Math.round(Number(row.reseller_price));
      }
    }
  }

  let price = retail;

  if (params.role === "reseller") {
    price = reseller ?? retail;

    const { data: vip, error: vipError } = await supabaseAdmin
      .from("reseller_price_overrides")
      .select("reseller_price")
      .eq("username", params.username)
      .eq("product_name", productName)
      .eq("duration", duration)
      .maybeSingle();

    if (vipError) {
      console.error("VIP PRICE LOOKUP ERROR:", vipError.message);
      return { ok: false, error: "Could not verify price.", httpStatus: 503 };
    }

    if (vip && Number.isFinite(Number(vip.reseller_price))) {
      price = Number(vip.reseller_price);
    }
  }

  if (price === null || !Number.isFinite(price) || price <= 0) {
    return { ok: false, error: "This item is not available for purchase.", httpStatus: 409 };
  }

  return {
    ok: true,
    price: Math.round(price * 100) / 100,
    status,
    fulfillmentType: product.fulfillmentType,
  };
}
