import { NextResponse } from "next/server";
import { publicCouponView } from "@/lib/coupons";
import { loadCoupons } from "@/lib/coupons-server";

export const dynamic = "force-dynamic";

/**
 * Public storefront hint: which percentages are available per product.
 * Codes are NEVER included.
 */
export async function GET() {
  const loaded = await loadCoupons();
  const view = loaded.ok ? publicCouponView(loaded.coupons) : { all: [], products: {} };
  return NextResponse.json({ success: true, ...view }, { headers: { "Cache-Control": "no-store" } });
}
