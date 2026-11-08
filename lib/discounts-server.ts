import { readSetting, writeSetting } from "@/lib/tenant-db";
import { STORE_DISCOUNTS_KEY, sanitizeRules, type DiscountRule } from "@/lib/discounts";

/**
 * Server-only access to the discount rules (app_settings table, service role only).
 * A missing table or missing row simply means "no discounts". Any OTHER read error is reported
 * so the purchase quote can stop instead of charging a different price than the page showed.
 */
export async function loadDiscountRules(tenantId: string): Promise<{ ok: true; rules: DiscountRule[] } | { ok: false }> {
  const { data, error } = await readSetting(tenantId, STORE_DISCOUNTS_KEY);

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

export async function saveDiscountRules(tenantId: string, rules: DiscountRule[]): Promise<{ ok: boolean; error?: string }> {
  const { error } = await writeSetting(tenantId, STORE_DISCOUNTS_KEY, { rules });
  return error ? { ok: false, error: error.message } : { ok: true };
}
