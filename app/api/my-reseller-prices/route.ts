import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, normalizeRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Returns the logged-in reseller's OWN custom (VIP) prices.
 * Identity comes from the session cookie; any username in the body is ignored.
 * Anyone who is not a reseller gets an empty list.
 */
async function handle() {
  try {
    const user = await getSessionUser();

    if (!user || normalizeRole(user.role) !== "reseller") {
      return NextResponse.json({ prices: [] }, { headers: NO_STORE });
    }

    const username = String(user.username).trim();

    const { data, error } = await supabaseAdmin
      .from("reseller_price_overrides")
      .select("product_name, duration, reseller_price")
      .eq("username", username);

    if (error) {
      console.error("MY RESELLER PRICES ERROR:", error.message);
      return NextResponse.json({ prices: [] }, { headers: NO_STORE });
    }

    return NextResponse.json(
      {
        prices: (data || []).map((r: any) => ({
          product_name: String(r.product_name ?? "").trim(),
          duration: String(r.duration ?? "").trim(),
          reseller_price: Number(r.reseller_price),
        })),
      },
      { headers: NO_STORE }
    );
  } catch {
    return NextResponse.json({ prices: [] }, { headers: NO_STORE });
  }
}

export const GET = handle;
export const POST = handle;
