import { supabaseAdmin } from "@/lib/supabase-admin";
import { STORE_DISCOUNTS_KEY, sanitizeRules, type DiscountRule } from "@/lib/discounts";

/**
 * Server-only access to the discount rules (app_settings table, service role only).
 * A missing table or missing row simply means "no discounts". Any OTHER read error is reported
 * so the purchase quote can stop instead of charging a different price than the page showed.
 */
export async function loadDiscountRules(): Promise<{ ok: true; rules: DiscountRule[] } | { ok: false }> {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", STORE_DISCOUNTS_KEY)
    .maybeSingle();

  if (error) {
    if (/does not exist|schema cache|PGRST205|42P01/i.test(`${error.code ?? ""} ${error.message}`)) {
      return { ok: true, rules: [] };
    }
    console.error("DISCOUNT RULES LOOKUP ERROR:", error.message);
    return { ok: false };
  }

  const value: any = data?.value;
  return { ok: true, rules: sanitizeRules(value?.rules) };
}

export async function saveDiscountRules(rules: DiscountRule[]): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin.from("app_settings").upsert(
    { key: STORE_DISCOUNTS_KEY, value: { rules }, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}
