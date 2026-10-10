import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Public, customer-safe: the price/status overrides the storefront already displays.
export async function GET(request: NextRequest) {
  const product = String(request.nextUrl.searchParams.get("product") || "").trim();

  if (!product || product.length > 200) {
    return NextResponse.json({ rows: [] }, { status: 400, headers: NO_STORE });
  }

  const { data, error } = await supabaseAdmin
    .from("product_prices")
    .select("duration, price_inr, reseller_price")
    .eq("product_name", product);

  if (error) {
    console.error("PRODUCT PRICES ERROR:", error.message);
    return NextResponse.json({ rows: [], error: "unavailable" }, { status: 200, headers: NO_STORE });
  }

  return NextResponse.json({ rows: data || [] }, { headers: NO_STORE });
}
