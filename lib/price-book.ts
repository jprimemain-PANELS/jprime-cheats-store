import { supabaseAdmin } from "@/lib/supabase-admin";
import { allProducts } from "@/lib/products";
import { parseRupees } from "@/lib/price-math";

/**
 * One flat list of every product + duration with its CURRENT retail and default reseller price
 * (catalogue price, overridden by product_prices exactly like the storefront and the purchase
 * quote do). The admin bulk tools start from this so "10% off" always means 10% off the price
 * customers really see today.
 */

const STATUS_ROW = "__status__";

export interface PriceRow {
  product_name: string;
  category: string;
  duration: string;
  retail: number;
  reseller: number | null; // default reseller price, null when none is set
}

async function fetchAll(table: string, columns: string): Promise<{ ok: true; rows: any[] } | { ok: false; error: string }> {
  const rows: any[] = [];
  for (let page = 0; page < 20; page += 1) {
    const from = page * 1000;
    const { data, error } = await supabaseAdmin.from(table).select(columns).range(from, from + 999);
    if (error) return { ok: false, error: error.message };
    rows.push(...(data || []));
    if ((data || []).length < 1000) break;
  }
  return { ok: true, rows };
}

export async function loadPriceBook(): Promise<{ ok: true; rows: PriceRow[] } | { ok: false; error: string }> {
  const catalog = await fetchAll("products_catalog", "name, data");
  if (!catalog.ok) return { ok: false, error: catalog.error };

  let products: { name: string; category: string; prices: any[] }[] = catalog.rows
    .map((row) => {
      const d: any = row?.data && typeof row.data === "object" ? row.data : {};
      return {
        name: String(d.name || row?.name || "").trim(),
        category: String(d.category || "").trim().toLowerCase(),
        prices: Array.isArray(d.prices) ? d.prices : [],
      };
    })
    .filter((p) => p.name);

  if (products.length === 0) {
    products = allProducts.map((p) => ({
      name: p.name,
      category: String(p.category || "").toLowerCase(),
      prices: p.prices as any[],
    }));
  }

  const overridesResult = await fetchAll("product_prices", "product_name, duration, price_inr, reseller_price");
  if (!overridesResult.ok) return { ok: false, error: overridesResult.error };

  const overrides = new Map<string, { retail: number | null; reseller: number | null }>();
  for (const row of overridesResult.rows) {
    if (row.duration === STATUS_ROW) continue;
    const retail = Number(row.price_inr);
    const reseller = row.reseller_price != null ? Number(row.reseller_price) : null;
    overrides.set(`${String(row.product_name).trim()}::${String(row.duration).trim()}`, {
      retail: Number.isFinite(retail) && retail > 0 ? Math.round(retail) : null,
      reseller: reseller != null && Number.isFinite(reseller) && reseller > 0 ? Math.round(reseller) : null,
    });
  }

  const rows: PriceRow[] = [];
  for (const product of products) {
    for (const tier of product.prices) {
      const duration = String(tier?.duration ?? "").trim();
      if (!duration || duration === STATUS_ROW) continue;

      const override = overrides.get(`${product.name}::${duration}`);
      const retail = override?.retail ?? parseRupees(tier?.priceINR);
      if (retail == null) continue;

      rows.push({
        product_name: product.name,
        category: product.category,
        duration,
        retail,
        reseller: override?.reseller ?? parseRupees(tier?.resellerPrice),
      });
    }
  }

  return { ok: true, rows };
}
