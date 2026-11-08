import { NextRequest, NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/auth";
import { loadPriceBook } from "@/lib/price-book";

export const dynamic = "force-dynamic";

/** GET /api/admin/price-book -> every product + duration with its current retail / reseller price. */
export async function GET(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;

  const book = await loadPriceBook(auth.tenant.id);
  if (!book.ok) {
    return NextResponse.json({ success: false, error: "Could not load prices." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ success: true, rows: book.rows }, { headers: { "Cache-Control": "no-store" } });
}
