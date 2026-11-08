import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isValidCode, normalizeCode, sanitizeCoupons, type Coupon } from "@/lib/coupons";
import { loadCoupons, saveCoupons } from "@/lib/coupons-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

const reply = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status, headers: NO_STORE });

/** GET -> every coupon (admin only; this is the only place codes are returned). */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const loaded = await loadCoupons();
  if (!loaded.ok) return reply(500, { success: false, error: "Could not load coupons." });
  return reply(200, { success: true, coupons: loaded.coupons });
}

/**
 * POST { action: "save" | "toggle" | "delete", ... }
 *   save   : { id?, code, percent, scope, products, enabled, startsAt, endsAt }
 *   toggle : { id, enabled }
 *   delete : { id }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "save");

    const loaded = await loadCoupons();
    if (!loaded.ok) return reply(500, { success: false, error: "Could not load coupons." });
    let list: Coupon[] = loaded.coupons;

    if (action === "save") {
      const code = normalizeCode(body?.code);
      if (!isValidCode(code)) {
        return reply(400, { success: false, error: "Code must be 3–24 letters, numbers, - or _ (no spaces)." });
      }

      const percent = Number(body?.percent);
      if (!Number.isInteger(percent) || percent < 1 || percent > 90) {
        return reply(400, { success: false, error: "Discount must be a whole number from 1 to 90." });
      }

      const scope = body?.scope === "products" ? "products" : "all";
      if (scope === "products" && !(Array.isArray(body?.products) && body.products.length > 0)) {
        return reply(400, { success: false, error: "Choose at least one product, or choose All products." });
      }

      const startsAt = body?.startsAt ? Date.parse(String(body.startsAt)) : NaN;
      const endsAt = body?.endsAt ? Date.parse(String(body.endsAt)) : NaN;
      if (body?.startsAt && !Number.isFinite(startsAt)) return reply(400, { success: false, error: "Start date is not valid." });
      if (body?.endsAt && !Number.isFinite(endsAt)) return reply(400, { success: false, error: "End date is not valid." });
      if (Number.isFinite(startsAt) && Number.isFinite(endsAt) && endsAt <= startsAt) {
        return reply(400, { success: false, error: "End date must be after the start date." });
      }

      const id = String(body?.id || "");
      if (list.some((c) => c.code === code && c.id !== id)) {
        return reply(400, { success: false, error: `The code ${code} already exists.` });
      }

      const [clean] = sanitizeCoupons([
        {
          id: id || `${code}-${Date.now().toString(36)}`,
          code,
          percent,
          scope,
          products: body?.products,
          enabled: body?.enabled !== false,
          startsAt: Number.isFinite(startsAt) ? new Date(startsAt).toISOString() : null,
          endsAt: Number.isFinite(endsAt) ? new Date(endsAt).toISOString() : null,
        },
      ]);
      if (!clean) return reply(400, { success: false, error: "Coupon is not valid." });

      list = id && list.some((c) => c.id === id) ? list.map((c) => (c.id === id ? clean : c)) : [...list, clean];
    } else if (action === "toggle") {
      const id = String(body?.id || "");
      if (!list.some((c) => c.id === id)) return reply(404, { success: false, error: "Coupon not found." });
      list = list.map((c) => (c.id === id ? { ...c, enabled: body?.enabled === true } : c));
    } else if (action === "delete") {
      const id = String(body?.id || "");
      list = list.filter((c) => c.id !== id);
    } else {
      return reply(400, { success: false, error: "Unknown action." });
    }

    const saved = await saveCoupons(list);
    if (!saved.ok) {
      console.error("COUPON SAVE ERROR:", saved.error);
      return reply(500, { success: false, error: "Could not save. Make sure the app_settings table exists (run supabase/PAYMENT_GATEWAY_SWITCH.sql)." });
    }
    return reply(200, { success: true, coupons: list });
  } catch (error: any) {
    console.error("ADMIN COUPONS ERROR:", error?.message);
    return reply(500, { success: false, error: "Unexpected error." });
  }
}
