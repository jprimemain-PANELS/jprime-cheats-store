import { NextResponse } from "next/server";
import { currentTenant } from "@/lib/tenant";
import { publicBrand } from "@/lib/tenant-admin";

export const dynamic = "force-dynamic";

/** Public, non-sensitive branding of the CURRENT store (resolved from the Host, never from input). */
export async function GET() {
  const tenant = await currentTenant();
  if (!tenant) return NextResponse.json({ success: false, error: "Store not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const b = await publicBrand(tenant);
  return NextResponse.json({ success: true, brand: b, status: tenant.status }, { headers: { "Cache-Control": "no-store" } });
}
