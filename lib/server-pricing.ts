import { supabaseAdmin } from "@/lib/supabase-admin";
import { allProducts } from "@/lib/products";

function numericPrice(value: unknown): number | null {
  const parsed = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function resolveServerPrice(username: string, role: string, productName: string, duration: string) {
  const { data: row, error: catalogError } = await supabaseAdmin
    .from("products_catalog")
    .select("name, data")
    .eq("name", productName)
    .maybeSingle();

  if (catalogError) throw new Error("Unable to verify product price.");

  let product: any = row?.data || null;
  if (!product) product = allProducts.find((p: any) => p.name === productName) || null;
  if (!product) return { price: null as number | null, online: false };

  const tier = Array.isArray(product.prices)
    ? product.prices.find((p: any) => String(p?.duration ?? "").trim() === duration)
    : null;
  if (!tier) return { price: null as number | null, online: false };

  let online = String(product.status || "ONLINE").toUpperCase() !== "MAINTENANCE";
  const { data: statusRow, error: statusError } = await supabaseAdmin
    .from("product_prices")
    .select("price_inr")
    .eq("product_name", productName)
    .eq("duration", "__status__")
    .maybeSingle();
  if (statusError) throw new Error("Unable to verify product status.");
  if (statusRow) online = Number(statusRow.price_inr) !== 1;

  const { data: commonOverride, error: priceError } = await supabaseAdmin
    .from("product_prices")
    .select("price_inr, reseller_price")
    .eq("product_name", productName)
    .eq("duration", duration)
    .maybeSingle();
  if (priceError) throw new Error("Unable to verify product price.");

  const regularPrice = numericPrice(commonOverride?.price_inr) ?? numericPrice(tier.priceINR);
  let resellerPrice = numericPrice(commonOverride?.reseller_price) ?? numericPrice(tier.resellerPrice);

  if (role === "reseller") {
    const { data: vip, error: vipError } = await supabaseAdmin
      .from("reseller_price_overrides")
      .select("reseller_price")
      .eq("username", username)
      .eq("product_name", productName)
      .eq("duration", duration)
      .maybeSingle();
    if (vipError) throw new Error("Unable to verify reseller price.");
    resellerPrice = numericPrice(vip?.reseller_price) ?? resellerPrice;
  }

  return { price: role === "reseller" ? resellerPrice ?? regularPrice : regularPrice, online };
}
