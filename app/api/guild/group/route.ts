import { NextRequest, NextResponse } from "next/server";
import { requireUser, rateLimit } from "@/lib/auth";
import { deleteGroup, getGroupInfo, getGroupList, groupAction } from "@/lib/guild-glory";
import { writeSetting } from "@/lib/tenant-db";
import { logGuildRefundRequest } from "@/lib/user-admin";
import { NO_STORE, fail, guildGate, loadGroups } from "../_shared";

export const dynamic = "force-dynamic";

/** The customer's OWN group only: it must be in their saved list. Returns the seller's group id, or an error response. */
async function ownGroup(request: NextRequest, ref: string) {
  const auth = await requireUser(request);
  if (!auth.ok) return { err: auth.response };
  const tenantId = auth.tenant.id;
  const blocked = guildGate(auth.tenant, tenantId);
  if (blocked) return { err: blocked };
  if (!rateLimit(`guild-group:${tenantId}:${auth.user.username}`, 40, 60_000)) return { err: fail("Too many requests. Please wait a moment.", 429) };
  const { recs, save } = await loadGroups(tenantId, auth.user.username, true);
  const rec = recs.find((g) => g.ref === ref);
  if (!rec) return { err: fail("Group not found.", 404) };
  if (!rec.gid) return { err: fail(Date.now() - (Date.parse(rec.at) || 0) > 10 * 60_000 ? "This group is no longer active on the service." : "This group is still starting. Try again in a moment.", 409) };
  const s = { group_id: rec.gid };
  return { groupId: s.group_id, rec, recs, tenantId, username: auth.user.username, save, admin: String(auth.user.role).toLowerCase() === "admin" };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const ref = String(url.searchParams.get("ref") ?? "").slice(0, 100);
    const o = await ownGroup(request, ref);
    if (o.err) return o.err;
    const view = url.searchParams.get("view");
    if (view === "history" || view === "players") {
      const l = await getGroupList(o.groupId, view);
      return l.ok ? NextResponse.json({ success: true, rows: l.rows }, { headers: NO_STORE }) : fail(l.error, 502);
    }
    const info = await getGroupInfo(o.groupId, url.searchParams.get("force") === "1");
    if (!info.ok) return fail(info.error, 502);
    if (info.view.name && info.view.name !== o.rec.name) { o.rec.name = info.view.name; await o.save().catch(() => {}); } // remember the name
    return NextResponse.json({ success: true, group: info.view, ...(o.admin && url.searchParams.get("raw") === "1" ? { raw: info.raw } : {}) }, { headers: NO_STORE });
  } catch { return fail("Could not load the group.", 500); }
}

export async function POST(request: NextRequest) {
  try {
    const b = await request.json().catch(() => ({}));
    const action = ["restart", "stop", "refresh", "delete", "refund"].includes(b?.action) ? (b.action as string) : null;
    if (!action) return fail("Unknown action.", 400);
    const o = await ownGroup(request, String(b?.ref ?? "").slice(0, 100));
    if (o.err) return o.err;
    if (action === "refund") {
      // The seller API has no refund call: this records a request for the store admin to review (no money moves automatically).
      if ((o.rec as any).refundRequested) return NextResponse.json({ success: true, message: "Refund already requested." }, { headers: NO_STORE });
      (o.rec as any).refundRequested = new Date().toISOString();
      await o.save();
      await logGuildRefundRequest(o.tenantId, o.username, o.groupId, `clan ${o.rec.clan} (${o.rec.regionName})`).catch(() => {});
      return NextResponse.json({ success: true, message: "Refund request sent to the admin." }, { headers: NO_STORE });
    }
    if (action === "delete") {
      const d = await deleteGroup(o.groupId);
      if (!d.ok) return fail(d.error, 502);
      await writeSetting(o.tenantId, `guildgroups:${o.username}`, o.recs.filter((g) => g.ref !== o.rec.ref));
      return NextResponse.json({ success: true, removed: true }, { headers: NO_STORE });
    }
    const r = await groupAction(o.groupId, action === "refresh" ? "refresh-all" : (action as "restart" | "stop"));
    if (!r.ok) return fail(r.error, 502);
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch { return fail("The action failed.", 500); }
}
