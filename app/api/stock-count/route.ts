import { NextRequest, NextResponse } from "next/server";
import { currentTenant } from "@/lib/tenant";
import { countLocalStock } from "@/lib/stock";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Public, customer-safe: only a number. The stock_keys table itself is never exposed.
// Uses the SAME matching rule as the admin Stock Matrix and the real key reservation
// (lib/stock.ts): unused keys only, case / spacing insensitive.
export async function GET(request: NextRequest) {
  const product = String(request.nextUrl.searchParams.get("product") || "").trim();
  const duration = String(request.nextUrl.searchParams.get("duration") || "").trim();

  if (!product || !duration || product.length > 200 || duration.length > 100) {
    return NextResponse.json({ count: null }, { status: 400, headers: NO_STORE });
  }

  const tenant = await currentTenant();
  if (!tenant) return NextResponse.json({ count: null }, { status: 404, headers: NO_STORE });

  const result = await countLocalStock(tenant.id, product, duration);

  if (!result.ok) {
    return NextResponse.json({ count: null }, { headers: NO_STORE });
  }

  return NextResponse.json({ count: result.data }, { headers: NO_STORE });
}
