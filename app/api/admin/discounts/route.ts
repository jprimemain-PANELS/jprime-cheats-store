import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireTenantAdmin } from "@/lib/auth";
import { sanitizeRules, type DiscountRule } from "@/lib/discounts";
import { loadDiscountRules, saveDiscountRules } from "@/lib/discounts-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status, headers: NO_STORE });
}

export async function GET(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;

  const result = await loadDiscountRules(auth.tenant.id);
  if (!result.ok) return fail("Could not load discounts.", 500);
  return NextResponse.json({ success: true, rules: result.rules }, { headers: NO_STORE });
}

/**
 * POST { action: "save", rule }            create or update one rule
 *      { action: "toggle", id, enabled }   switch a rule on/off
 *      { action: "delete", id }
 *      { action: "stop_all" }              switch every rule off
 */
export async function POST(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const action = String(body?.action || "");

    const current = await loadDiscountRules(auth.tenant.id);
    if (!current.ok) return fail("Could not load discounts.", 500);
    let rules: DiscountRule[] = current.rules;

    if (action === "save") {
      const raw = { ...(body?.rule || {}) };
      raw.id = String(raw.id || "").trim() || randomUUID();

      const percent = Number(raw.percent);
      if (!Number.isFinite(percent) || percent < 1 || percent > 90) return fail("Discount must be between 1% and 90%.");

      const [clean] = sanitizeRules([raw]);
      if (!clean) return fail("Choose which products the discount applies to.");

      if (clean.startsAt && clean.endsAt && new Date(clean.endsAt) <= new Date(clean.startsAt)) {
        return fail("The end time must be after the start time.");
      }

      const index = rules.findIndex((r) => r.id === clean.id);
      if (index >= 0) rules[index] = clean;
      else rules = [...rules, clean];
    } else if (action === "toggle") {
      const id = String(body?.id || "");
      rules = rules.map((r) => (r.id === id ? { ...r, enabled: body?.enabled === true } : r));
    } else if (action === "delete") {
      const id = String(body?.id || "");
      rules = rules.filter((r) => r.id !== id);
    } else if (action === "stop_all") {
      rules = rules.map((r) => ({ ...r, enabled: false }));
    } else {
      return fail("Unknown action.");
    }

    if (rules.length > 100) return fail("Too many discounts. Delete old ones first.");

    const saved = await saveDiscountRules(auth.tenant.id, rules);
    if (!saved.ok) {
      console.error("DISCOUNT SAVE ERROR:", saved.error);
      return fail("Could not save. Make sure the app_settings table exists (it is created by PAYMENT_GATEWAY_SWITCH.sql).", 500);
    }

    return NextResponse.json({ success: true, rules }, { headers: NO_STORE });
  } catch (error: any) {
    console.error("ADMIN DISCOUNTS ERROR:", error?.message);
    return fail("Discount request failed.", 500);
  }
}
