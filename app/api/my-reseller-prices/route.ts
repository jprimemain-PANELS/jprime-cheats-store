import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * POST /api/my-reseller-prices
 * Body: { username }
 * Returns only that reseller's own custom prices.
 * Returns an empty list for anyone whose role in the database is not "reseller".
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = String(body?.username || "").trim();

    if (!username) {
      return NextResponse.json({ prices: [] }, { headers: NO_STORE });
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("username, role")
      .eq("username", username)
      .maybeSingle();

    if (userError || !user || user.role !== "reseller") {
      return NextResponse.json({ prices: [] }, { headers: NO_STORE });
    }

    const { data, error } = await supabaseAdmin
      .from("reseller_price_overrides")
      .select("product_name, duration, reseller_price")
      .eq("username", username);

    if (error) {
      console.error("MY RESELLER PRICES ERROR:", error);
      return NextResponse.json({ prices: [] }, { headers: NO_STORE });
    }

    return NextResponse.json(
      {
        prices: (data || []).map((r: any) => ({
          product_name: r.product_name,
          duration: r.duration,
          reseller_price: Number(r.reseller_price),
        })),
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error("MY RESELLER PRICES EXCEPTION:", error);
    return NextResponse.json({ prices: [] }, { headers: NO_STORE });
  }
}