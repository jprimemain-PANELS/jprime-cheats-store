import { supabaseAdmin } from "@/lib/supabase-admin";
import { COUPONS_KEY, sanitizeCoupons, type Coupon } from "@/lib/coupons";

/**
 * Coupons live in the existing app_settings table (service role only).
 * A missing table/row simply means "no coupons". Any OTHER read error is reported so a purchase
 * with a coupon can stop instead of charging a price the customer did not see.
 */
export async function loadCoupons(): Promise<{ ok: true; coupons: Coupon[] } | { ok: false }> {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", COUPONS_KEY)
    .maybeSingle();

  if (error) {
    if (/does not exist|schema cache|PGRST205|42P01/i.test(`${error.code ?? ""} ${error.message}`)) {
      return { ok: true, coupons: [] };
    }
    console.error("COUPON LOOKUP ERROR:", error.message);
    return { ok: false };
  }

  const value: any = data?.value;
  return { ok: true, coupons: sanitizeCoupons(value?.coupons) };
}

export async function saveCoupons(coupons: Coupon[]): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert({ key: COUPONS_KEY, value: { coupons }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  return error ? { ok: false, error: error.message } : { ok: true };
}
