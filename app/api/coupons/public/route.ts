import { NextResponse } from "next/server";
import { publicCouponView } from "@/lib/coupons";
import { loadCoupons } from "@/lib/coupons-server";
import { currentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * Public storefront hint: which percentages are available per product.
 * Codes are NEVER included.
 */
export async function GET() {
  const tenant = await currentTenant();
  const loaded = tenant ? await loadCoupons(tenant.id) : ({ ok: false } as const);
  const view = loaded.ok ? publicCouponView(loaded.coupons) : { all: [], products: {} };
  return NextResponse.json({ success: true, ...view }, { headers: { "Cache-Control": "no-store" } });
}
