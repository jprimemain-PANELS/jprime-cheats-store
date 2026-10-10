import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { allProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

// Admin-only: the built-in (lib/products.ts) product list, used by the admin
// Inventory / Pricing / Status tabs and "Import Existing". Keeping it behind an
// admin session means supplier IDs never ship in the public browser bundle.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    { success: true, products: allProducts },
    { headers: { "Cache-Control": "no-store" } }
  );
}
