import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/auth";
import { OWNER_TENANT_ID } from "@/lib/tenant";
import { acquire, creditWallet, debitWallet, getBalance, logWalletTransaction, release } from "@/lib/wallet";
import { createGuildGroup, deleteGroup, getGroupInfo, getGroupList, groupAction, isGuildId, listRegions, ownerGuildCreds, runWithGuild } from "@/lib/guild-glory";
import { guildCostPerGroup } from "@/lib/store-guild";
import { partnerFromKey, type Partner } from "@/lib/guild-partners";
import { loadGroups } from "@/app/api/guild/_shared";
import { writeSetting } from "@/lib/tenant-db";

export const dynamic = "force-dynamic";
const H = { "Cache-Control": "no-store" };
const out = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: H });
const err = (error: string, status = 400, extra: Record<string, unknown> = {}) => out({ success: false, error, ...extra }, status);
const bucket = (p: Partner) => `partner:${p.id}`;

/**
 * Partner API (other websites that sell Guild Glory through THIS website). Header: Authorization: Bearer gp_...
 *   GET    /api/partner/guild/account                  balance + price per group
 *   GET    /api/partner/guild/regions
 *   GET    /api/partner/guild/groups                   the partner's own groups
 *   POST   /api/partner/guild/groups                   { region, clan_id }  (+ optional header Idempotency-Key) -> charges the partner wallet
 *   GET    /api/partner/guild/groups/{ref}             live info;  ?view=history|players for lists
 *   POST   /api/partner/guild/groups/{ref}/actions     { action: "restart" | "stop" | "refresh" }
 *   DELETE /api/partner/guild/groups/{ref}
 * A partner only ever sees and controls groups it created itself.
 */
async function handle(request: NextRequest, path: string[]): Promise<Response> {
  const creds = ownerGuildCreds();
  const partner = await partnerFromKey((request.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""));
  if (!partner) return err("Invalid or disabled API key.", 401);
  if (!rateLimit(`partner-guild:${partner.id}`, 90, 60_000)) return err("Too many requests.", 429);
  if (!creds) return err("Service is not available right now.", 503);
  const method = request.method;
  const [a, ref, c] = path;

  if (a === "account" && method === "GET") {
    const bal = await getBalance(OWNER_TENANT_ID, partner.username);
    const cost = partner.cost > 0 ? partner.cost : await guildCostPerGroup(partner.username);
    return out({ success: true, balance: bal, cost_per_group: cost });
  }
  if (a === "regions" && method === "GET") {
    const r = await listRegions();
    return r.ok ? out({ success: true, regions: r.regions }) : err("Regions are not available right now.", 502);
  }
  if (a !== "groups") return err("Not found.", 404);

  if (!ref) {
    if (method === "GET") {
      const { recs, seller } = await loadGroups(OWNER_TENANT_ID, bucket(partner), true);
      return out({ success: true, groups: recs.map((g) => ({ ref: g.ref, clan_id: g.clan, region: g.region, created_at: g.at, name: g.name ?? null, status: g.refunded ? "refunded" : seller.find((s) => s.group_id === g.gid)?.status ?? (g.gid ? "unknown" : "starting") })) });
    }
    if (method === "POST") {
      const b = await request.json().catch(() => ({}));
      const clanId = String(b?.clan_id ?? b?.guild_id ?? "").trim();
      const region = String(b?.region ?? "").trim();
      if (!isGuildId(clanId)) return err("clan_id must be the numbers-only Guild / Clan ID.");
      const regions = await listRegions();
      if (!regions.ok) return err("Regions are not available right now.", 502);
      const reg = regions.regions.find((r) => r.id === region);
      if (!reg) return err("Unknown region.");
      const idemIn = String(request.headers.get("idempotency-key") ?? "").trim();
      if (idemIn && !/^[A-Za-z0-9_.:-]{8,64}$/.test(idemIn)) return err("Idempotency-Key must be 8-64 letters, numbers or - _ . :");
      const lock = `partner-launch:${partner.id}`;
      if (!acquire(lock)) return err("Another request is in progress.", 409);
      try {
        const { recs } = await loadGroups(OWNER_TENANT_ID, bucket(partner), false);
        const idem = idemIn ? `pt-${partner.id}-${idemIn}`.slice(0, 100) : `pt-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`;
        const dup = idemIn ? recs.find((g: any) => g.idem === idem) : null;
        if (dup) return out({ success: true, duplicate: true, group: { ref: dup.ref, clan_id: dup.clan, region: dup.region } });
        const cost = partner.cost > 0 ? partner.cost : await guildCostPerGroup(partner.username);
        if (!(cost > 0)) return err("Service is not available right now.", 503);
        const pay = await debitWallet(OWNER_TENANT_ID, partner.username, cost);
        if (!pay.ok) return err(pay.reason === "insufficient" ? "Not enough wallet balance. Top up the partner wallet." : "Could not charge the wallet.", pay.reason === "insufficient" ? 402 : 500, { cost_per_group: cost });
        await logWalletTransaction({ tenantId: OWNER_TENANT_ID, username: partner.username, type: "debit", amount: cost, balance_after: pay.balance, description: `Guild Glory partner group ${clanId} (${reg.name})` });
        let res: Awaited<ReturnType<typeof createGuildGroup>>;
        try { res = await createGuildGroup({ region: reg.id, clanId, idem }); } catch { res = { success: false, error: "failed" }; }
        if (!res.success) {
          const back = await creditWallet(OWNER_TENANT_ID, partner.username, cost);
          if (back.ok) await logWalletTransaction({ tenantId: OWNER_TENANT_ID, username: partner.username, type: "refund", amount: cost, balance_after: back.balance, description: "Refund: Guild Glory partner group failed" });
          else console.error("GUILD PARTNER REFUND FAILED - MANUAL REVIEW:", { partner: partner.id, cost });
          return err("Could not start the bot right now. The wallet charge was returned.", 502, { balance: back.ok ? back.balance : undefined });
        }
        const rec: any = { ref: res.ref, clan: clanId, region: reg.id, regionName: reg.name, at: new Date().toISOString(), idem };
        await writeSetting(OWNER_TENANT_ID, `guildgroups:${bucket(partner)}`, [rec, ...recs].slice(0, 300));
        return out({ success: true, group: { ref: rec.ref, clan_id: clanId, region: reg.id }, charged: cost, balance: pay.balance }, 201);
      } finally { release(lock); }
    }
    return err("Method not allowed.", 405);
  }

  // one of the partner's OWN groups
  const { recs, save } = await loadGroups(OWNER_TENANT_ID, bucket(partner), true);
  const rec = recs.find((g) => g.ref === ref);
  if (!rec) return err("Group not found.", 404);
  if (!rec.gid) return err("This group is still starting. Try again in a moment.", 409);
  if (!c && method === "GET") {
    const view = new URL(request.url).searchParams.get("view");
    if (view === "history" || view === "players") {
      const l = await getGroupList(rec.gid, view);
      return l.ok ? out({ success: true, rows: l.rows }) : err(l.error, 502);
    }
    const info = await getGroupInfo(rec.gid, false);
    if (!info.ok) return err(info.error, 502);
    if (info.view.name && info.view.name !== rec.name) { rec.name = info.view.name; await save().catch(() => {}); }
    return out({ success: true, group: info.view });
  }
  if (c === "actions" && method === "POST") {
    const b = await request.json().catch(() => ({}));
    const act = b?.action === "refresh" ? "refresh-all" : b?.action;
    if (act !== "restart" && act !== "stop" && act !== "refresh-all") return err("action must be restart, stop or refresh.");
    const r = await groupAction(rec.gid, act);
    return r.ok ? out({ success: true }) : err(r.error, 502);
  }
  if (!c && method === "DELETE") {
    const d = await deleteGroup(rec.gid);
    if (!d.ok) return err(d.error, 502);
    await writeSetting(OWNER_TENANT_ID, `guildgroups:${bucket(partner)}`, recs.filter((g) => g.ref !== rec.ref));
    return out({ success: true, removed: true });
  }
  return err("Not found.", 404);
}

async function entry(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await ctx.params;
    return await runWithGuild(ownerGuildCreds(), () => handle(request, (path ?? []).map((s) => String(s).slice(0, 100))));
  } catch (e) {
    console.error("PARTNER GUILD ERROR:", e instanceof Error ? e.message : "unknown");
    return err("Request failed.", 500);
  }
}
export const GET = entry, POST = entry, DELETE = entry;
