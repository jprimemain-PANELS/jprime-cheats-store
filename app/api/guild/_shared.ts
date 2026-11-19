import { NextResponse } from "next/server";
import { tdb, readSetting, writeSetting } from "@/lib/tenant-db";
import { bindGroups, listSellerGroups, runWithGuild, type GroupRec, type SellerGroup } from "@/lib/guild-glory";
import { loadGuildCreds } from "@/lib/store-guild";
import { canTransact, currentTenant, SUSPENDED_MESSAGE } from "@/lib/tenant";

export const NO_STORE = { "Cache-Control": "no-store" };
export const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ success: false, error, ...extra }, { status, headers: NO_STORE });

/** Runs a Guild route with THIS store's seller credentials: the owner store uses the server env key, a co-admin store uses its own saved key (never the owner's). */
export function withGuild<A extends unknown[]>(handler: (...a: A) => Promise<Response>) {
  return async (...a: A): Promise<Response> => {
    const t = await currentTenant();
    const creds = t ? await loadGuildCreds(t.id) : null;
    return runWithGuild(creds, () => handler(...a));
  };
}
/** Only an active store can sell Guild tokens (the store must also have a connection, which the routes report as "connected: false"). Returns an error response or null. */
export function guildGate(tenant: any, _tenantId: string) {
  if (!canTransact(tenant)) return fail(SUSPENDED_MESSAGE, 403);
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
