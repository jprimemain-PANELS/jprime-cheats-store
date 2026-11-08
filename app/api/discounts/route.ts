import { NextResponse } from "next/server";
import { isRuleActive } from "@/lib/discounts";
import { loadDiscountRules } from "@/lib/discounts-server";
import { currentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * Public, customer-safe: only the discounts that are running right now (label, percent, who they
 * apply to, end time) for the store the visitor is on. The storefront uses this to draw
 * struck-through prices; the real price a customer is charged is always decided again on the
 * server at purchase time.
 */
export async function GET() {
  const tenant = await currentTenant();
  const result = tenant ? await loadDiscountRules(tenant.id) : ({ ok: false } as const);
  const now = new Date();

  const rules = result.ok
    ? result.rules
        .filter((r) => isRuleActive(r, now))
        .map((r) => ({ id: r.id, label: r.label, percent: r.percent, scope: r.scope, startsAt: r.startsAt, endsAt: r.endsAt, enabled: true }))
    : [];

  return NextResponse.json({ rules }, { headers: { "Cache-Control": "no-store" } });
}
