import { NextRequest, NextResponse } from "next/server";
import { rateLimit, requireTenantAdmin } from "@/lib/auth";
import { getGuildKeyView, saveGuildKey } from "@/lib/store-guild";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO_STORE });

/** The store's own Guild Glory seller key (co-admin stores). The key is never returned, only its last 4 characters. */
export async function GET(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ success: true, ...(await getGuildKeyView(auth.tenant.id)) }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  if (!rateLimit(`guild-key:${auth.tenant.id}:${auth.user.username}`, 15, 60_000)) return fail("Too many requests.", 429);
  const b = await request.json().catch(() => ({}));
  const r = await saveGuildKey(auth.tenant.id, b);
  return r.ok ? NextResponse.json({ success: true, ...(await getGuildKeyView(auth.tenant.id)) }, { headers: NO_STORE }) : fail(r.error, r.error.includes("main store") ? 403 : 400);
}
