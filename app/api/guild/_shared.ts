import { NextResponse } from "next/server";
import { tdb } from "@/lib/tenant-db";
import { OWNER_TENANT_ID, canTransact, SUSPENDED_MESSAGE } from "@/lib/tenant";

export const NO_STORE = { "Cache-Control": "no-store" };
export const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ success: false, error, ...extra }, { status, headers: NO_STORE });

/** Guild Glory runs on the main store only (the seller account is the owner's). Returns an error response or null. */
export function guildGate(tenant: any, tenantId: string) {
  if (!canTransact(tenant)) return fail(SUSPENDED_MESSAGE, 403);
  if (tenantId !== OWNER_TENANT_ID) return fail("This service is not available in this store.", 403);
  return null;
}
/** True when the named product exists and the admin marked it as a Guild product. */
export async function isGuildProduct(tenantId: string, productName: string) {
  const cat = await tdb(tenantId).from("products_catalog").select("data").eq("name", productName).maybeSingle();
  return !cat.error && (cat.data as any)?.data?.kind === "guild";
}
