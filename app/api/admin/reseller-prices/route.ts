import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const email = request.headers.get("x-admin-email")?.trim();

  if (!email) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Admin email is required" },
        { status: 401 }
      ),
    };
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, email, role")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("ADMIN LOOKUP ERROR:", error);
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Could not verify admin" },
        { status: 500 }
      ),
    };
  }

  if (!user || user.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      ),
    };
  }

  return { ok: true };
}

async function loadRows(username: string) {
  return supabaseAdmin
    .from("reseller_price_overrides")
    .select("product_name, duration, reseller_price")
    .eq("username", username)
    .order("product_name", { ascending: true });
}

/**
 * GET /api/admin/reseller-prices?username=someone
 * Returns every custom (VIP) price saved for that reseller.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const username = String(
    request.nextUrl.searchParams.get("username") || ""
  ).trim();

  if (!username) {
    return NextResponse.json(
      { success: false, error: "Missing username" },
      { status: 400 }
    );
  }

  const { data, error } = await loadRows(username);

  if (error) {
    console.error("RESELLER PRICES GET ERROR:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    prices: (data || []).map((r: any) => ({
      product_name: r.product_name,
      duration: r.duration,
      reseller_price: Number(r.reseller_price),
    })),
  });
}

/**
 * POST /api/admin/reseller-prices
 * Body: {
 *   username,
 *   prices: [{ product_name, duration, reseller_price }],   // upsert
 *   remove: [{ product_name, duration }]                    // delete
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const username = String(body?.username || "").trim();

    if (!username) {
      return NextResponse.json(
        { success: false, error: "Missing username" },
        { status: 400 }
      );
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from("users")
      .select("username, role")
      .eq("username", username)
      .maybeSingle();

    if (targetError) {
      console.error("RESELLER LOOKUP ERROR:", targetError);
      return NextResponse.json(
        { success: false, error: "Could not verify reseller" },
        { status: 500 }
      );
    }

    if (!target || target.role !== "reseller") {
      return NextResponse.json(
        { success: false, error: "User is not a reseller" },
        { status: 400 }
      );
    }

    const rawPrices: any[] = Array.isArray(body?.prices) ? body.prices : [];
    const rawRemove: any[] = Array.isArray(body?.remove) ? body.remove : [];

    const upserts: {
      username: string;
      product_name: string;
      duration: string;
      reseller_price: number;
      updated_at: string;
    }[] = [];

    for (const p of rawPrices) {
      const productName = String(p?.product_name || "").trim();
      const duration = String(p?.duration || "").trim();
      const price = Number(p?.reseller_price);

      if (!productName || !duration || !Number.isFinite(price) || price < 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid price for "${productName || "?"}" / "${duration || "?"}"`,
          },
          { status: 400 }
        );
      }

      upserts.push({
        username,
        product_name: productName,
        duration,
        reseller_price: Math.round(price),
        updated_at: new Date().toISOString(),
      });
    }

    if (upserts.length > 0) {
      const { error } = await supabaseAdmin
        .from("reseller_price_overrides")
        .upsert(upserts, { onConflict: "username,product_name,duration" });

      if (error) {
        console.error("RESELLER PRICES SAVE ERROR:", error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

    for (const r of rawRemove) {
      const productName = String(r?.product_name || "").trim();
      const duration = String(r?.duration || "").trim();
      if (!productName || !duration) continue;

      const { error } = await supabaseAdmin
        .from("reseller_price_overrides")
        .delete()
        .eq("username", username)
        .eq("product_name", productName)
        .eq("duration", duration);

      if (error) {
        console.error("RESELLER PRICES DELETE ERROR:", error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

    const { data, error } = await loadRows(username);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      prices: (data || []).map((r: any) => ({
        product_name: r.product_name,
        duration: r.duration,
        reseller_price: Number(r.reseller_price),
      })),
    });
  } catch (error: any) {
    console.error("RESELLER PRICES EXCEPTION:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to save prices" },
      { status: 500 }
    );
  }
}