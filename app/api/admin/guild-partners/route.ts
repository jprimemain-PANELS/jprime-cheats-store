import { NextRequest, NextResponse } from "next/server";
import { rateLimit, requireAdmin } from "@/lib/auth";
import { createPartner, listPartners, updatePartner } from "@/lib/guild-partners";
import { OWNER_TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO_STORE });

/** Owner only: partner websites that sell Guild Glory through this website's API (keys are shown once, stored hashed). */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  if (auth.tenant.id !== OWNER_TENANT_ID) return fail("Owner only.", 403);
  return NextResponse.json({ success: true, partners: await listPartners(), base: new URL(request.url).origin }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  if (auth.tenant.id !== OWNER_TENANT_ID) return fail("Owner only.", 403);
  if (!rateLimit(`guild-partners:${auth.user.username}`, 30, 60_000)) return fail("Too many requests.", 429);
  const b = await request.json().catch(() => ({}));
  if (b?.action === "create") {
    const r = await createPartner(b);
    return r.ok ? NextResponse.json({ success: true, partner: r.partner, key: r.key }, { headers: NO_STORE }) : fail(r.error);
  }
  const id = String(b?.id ?? "");
  if (b?.action === "toggle") { const r = await updatePartner(id, { active: b.active === true }); return r.ok ? NextResponse.json({ success: true }, { headers: NO_STORE }) : fail(r.error); }
  if (b?.action === "cost") { const r = await updatePartner(id, { cost: Number(b.cost) || 0 }); return r.ok ? NextResponse.json({ success: true }, { headers: NO_STORE }) : fail(r.error); }
  if (b?.action === "rotate") { const r = await updatePartner(id, { rotate: true }); return r.ok ? NextResponse.json({ success: true, key: r.key }, { headers: NO_STORE }) : fail(r.error); }
  if (b?.action === "remove") { const r = await updatePartner(id, { remove: true }); return r.ok ? NextResponse.json({ success: true }, { headers: NO_STORE }) : fail(r.error); }
  return fail("Unknown action.");
}
