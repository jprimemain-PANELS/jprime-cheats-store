import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Public, customer-safe: only a number. The stock_keys table itself is never exposed.
export async function GET(request: NextRequest) {
  const product = String(request.nextUrl.searchParams.get("product") || "").trim();
  const duration = String(request.nextUrl.searchParams.get("duration") || "").trim();

  if (!product || !duration || product.length > 200 || duration.length > 100) {
    return NextResponse.json({ count: null }, { status: 400, headers: NO_STORE });
  }

  const { count, error } = await supabaseAdmin
    .from("stock_keys")
    .select("id", { count: "exact", head: true })
    .eq("product_name", product)
    .eq("duration", duration)
    .eq("is_used", false);

  if (error) {
    console.error("STOCK COUNT ERROR:", error.message);
    return NextResponse.json({ count: null }, { headers: NO_STORE });
  }

  return NextResponse.json({ count: count ?? 0 }, { headers: NO_STORE });
}
