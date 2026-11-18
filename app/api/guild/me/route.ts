import { NextRequest, NextResponse } from "next/server";
import { readSetting, writeSetting } from "@/lib/tenant-db";
import { requireUser } from "@/lib/auth";
import { creditWallet, getBalance } from "@/lib/wallet";
import { GROUP_CREDITS, creditsKey, guildApiConfigured, listRegions, listSellerGroups } from "@/lib/guild-glory";
import { NO_STORE, fail, guildGate } from "../_shared";

export const dynamic = "force-dynamic";
const DEAD = new Set(["failed", "refunded", "cancelled", "canceled", "error", "expired", "rejected"]);

/** Credits, available regions and this customer's groups (with live status). A group the seller failed/refunded gives the credit back once. */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { username } = auth.user;
  const tenantId = auth.tenant.id;
  const blocked = guildGate(auth.tenant, tenantId);
  if (blocked) return blocked;
  try {
    const cur = await readSetting(tenantId, `guildgroups:${username}`);
    let list: any[] = Array.isArray(cur.data?.value) ? cur.data.value : [];
    const [regions, seller] = guildApiConfigured() ? await Promise.all([listRegions(), list.length ? listSellerGroups() : Promise.resolve([])]) : [{ ok: false as const, error: "not connected" }, []];

    let changed = false;
    list = list.map((g) => {
      const s = seller.find((x) => x.group_id === g.ref) ?? seller.find((x) => x.clan_id === g.clan && x.region === g.region);
      return s ? { ...g, status: s.status } : g;
    });
    for (const g of list) {
      if (!g.refunded && DEAD.has(String(g.status ?? "").toLowerCase())) {
        g.refunded = true; changed = true;
        const back = await creditWallet(tenantId, creditsKey(username), GROUP_CREDITS);
        if (!back.ok) { g.refunded = false; changed = changed && list.some((x) => x.refunded); }
      }
    }
    if (changed) await writeSetting(tenantId, `guildgroups:${username}`, list.map(({ status, ...rest }) => ({ ...rest, ...(rest.refunded ? { status } : {}) })));
    const credits = (await getBalance(tenantId, creditsKey(username))) ?? 0;
    return NextResponse.json({
      success: true,
      credits,
      connected: guildApiConfigured(),
      regions: regions.ok ? regions.regions : [],
      groups: list.slice(0, 10).map((g) => ({ ref: g.ref, clan: g.clan, regionName: g.regionName, at: g.at, status: g.status ?? "starting", refunded: !!g.refunded })),
    }, { headers: NO_STORE });
  } catch {
    return fail("Could not load Guild Glory.", 500);
  }
}
