import { NextResponse } from "next/server";
import { tdb, readSetting, writeSetting } from "@/lib/tenant-db";
import { bindGroups, listSellerGroups, type GroupRec, type SellerGroup } from "@/lib/guild-glory";
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

/** The customer's saved groups, paired with the seller's real groups (the pairing is saved so it stays stable). */
export async function loadGroups(tenantId: string, username: string, live = true): Promise<{ recs: GroupRec[]; seller: SellerGroup[]; save: () => Promise<void> }> {
  const cur = await readSetting(tenantId, `guildgroups:${username}`);
  const recs: GroupRec[] = (Array.isArray(cur.data?.value) ? cur.data.value : []).filter((g: any) => g && typeof g.ref === "string");
  const seller = live && recs.length ? await listSellerGroups() : [];
  if (bindGroups(recs, seller)) await writeSetting(tenantId, `guildgroups:${username}`, recs);
  return { recs, seller, save: async () => { await writeSetting(tenantId, `guildgroups:${username}`, recs); } };
}
