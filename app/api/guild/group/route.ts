import { NextRequest, NextResponse } from "next/server";
import { readSetting } from "@/lib/tenant-db";
import { requireUser, rateLimit } from "@/lib/auth";
import { getGroupInfo, groupAction, listSellerGroups } from "@/lib/guild-glory";
import { NO_STORE, fail, guildGate } from "../_shared";

export const dynamic = "force-dynamic";

/** The customer's OWN group only: it must be in their saved list. Returns the seller's group id, or an error response. */
async function ownGroup(request: NextRequest, ref: string) {
  const auth = await requireUser(request);
  if (!auth.ok) return { err: auth.response };
  const tenantId = auth.tenant.id;
  const blocked = guildGate(auth.tenant, tenantId);
  if (blocked) return { err: blocked };
  if (!rateLimit(`guild-group:${tenantId}:${auth.user.username}`, 40, 60_000)) return { err: fail("Too many requests. Please wait a moment.", 429) };
  const cur = await readSetting(tenantId, `guildgroups:${auth.user.username}`);
  const list: any[] = Array.isArray(cur.data?.value) ? cur.data.value : [];
  const rec = list.find((g) => g && g.ref === ref);
  if (!rec) return { err: fail("Group not found.", 404) };
  const seller = await listSellerGroups();
  const s = seller.find((x) => x.group_id === rec.ref) ?? seller.find((x) => x.clan_id === rec.clan && x.region === rec.region);
  if (!s || !s.group_id) return { err: fail("This group is still starting. Try again in a moment.", 409) };
  return { groupId: s.group_id, rec, admin: String(auth.user.role).toLowerCase() === "admin" };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const ref = String(url.searchParams.get("ref") ?? "").slice(0, 100);
    const o = await ownGroup(request, ref);
    if (o.err) return o.err;
    const info = await getGroupInfo(o.groupId, url.searchParams.get("force") === "1");
    if (!info.ok) return fail(info.error, 502);
    return NextResponse.json({ success: true, group: info.view, ...(o.admin && url.searchParams.get("raw") === "1" ? { raw: info.raw } : {}) }, { headers: NO_STORE });
  } catch { return fail("Could not load the group.", 500); }
}

export async function POST(request: NextRequest) {
  try {
    const b = await request.json().catch(() => ({}));
    const action = b?.action === "restart" || b?.action === "stop" ? b.action : null;
    if (!action) return fail("Unknown action.", 400);
    const o = await ownGroup(request, String(b?.ref ?? "").slice(0, 100));
    if (o.err) return o.err;
    const r = await groupAction(o.groupId, action);
    if (!r.ok) return fail(r.error, 502);
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch { return fail("The action failed.", 500); }
}
