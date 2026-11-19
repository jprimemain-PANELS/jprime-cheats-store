import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { creditWallet, getBalance } from "@/lib/wallet";
import { GROUP_CREDITS, creditsKey, guildApiConfigured, listRegions } from "@/lib/guild-glory";
import { NO_STORE, fail, guildGate, withGuild, loadGroups } from "../_shared";

export const dynamic = "force-dynamic";
const DEAD = new Set(["failed", "refunded", "cancelled", "canceled", "error", "expired", "rejected"]);

/** Credits, available regions and this customer's groups (with live status). A group the seller failed/refunded gives the credit back once. */
export const GET = withGuild(async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { username } = auth.user;
  const tenantId = auth.tenant.id;
  const blocked = guildGate(auth.tenant, tenantId);
  if (blocked) return blocked;
  try {
    const { recs, seller, save } = await loadGroups(tenantId, username, guildApiConfigured());
    const regions = guildApiConfigured() ? await listRegions() : { ok: false as const, error: "not connected" };

    let changed = false;
    const views = recs.map((g) => {
      const s = (g.gid ? seller.find((x) => x.group_id === g.gid) : undefined) as any;
      return { g, status: s?.status as string | undefined, gone: !s && !!g.gid && seller.length > 0 };
    });
    for (const v of views) {
      if (!v.g.refunded && v.status && DEAD.has(v.status.toLowerCase())) {
        v.g.refunded = true; changed = true;
        const back = await creditWallet(tenantId, creditsKey(username), GROUP_CREDITS);
        if (!back.ok) { v.g.refunded = false; changed = recs.some((x) => x.refunded); }
      }
    }
    if (changed) await save();
    const credits = (await getBalance(tenantId, creditsKey(username))) ?? 0;
    return NextResponse.json({
      success: true,
      credits,
      connected: guildApiConfigured(),
      regions: regions.ok ? regions.regions : [],
      groups: views.slice(0, 10).map(({ g, status, gone }) => {
        // not matched at all after 10 minutes (or removed on the service) = no longer active
        const stale = !g.gid && Date.now() - (Date.parse(g.at) || 0) > 10 * 60_000 && guildApiConfigured();
        return { ref: g.ref, clan: g.clan, regionName: g.regionName, at: g.at, name: g.name ?? null, status: status ?? (gone || stale ? "ended" : "starting"), refunded: !!g.refunded, ended: !g.refunded && (gone || stale) };
      }),
    }, { headers: NO_STORE });
  } catch {
    return fail("Could not load Guild Glory.", 500);
  }
});
