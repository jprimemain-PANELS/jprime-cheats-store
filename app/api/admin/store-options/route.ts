import { NextRequest, NextResponse } from "next/server";
import { rateLimit, requireTenantAdmin } from "@/lib/auth";
import { getStoreOptions, saveStoreOptions, welcomeState } from "@/lib/store-options";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/** Owner (on the owner store) or the co-admin of THIS store. The store always comes from the verified session/host. */
export async function GET(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ success: true, options: await getStoreOptions(auth.tenant.id), isOwner: auth.tenant.kind === "owner", welcome: await welcomeState(auth.tenant.id) }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  if (!rateLimit(`store-options:${auth.user.username}:${auth.tenant.id}`, 30, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests." }, { status: 429, headers: NO_STORE });
  }
  const b = await request.json().catch(() => ({}));
  const r = await saveStoreOptions(auth.tenant.id, b);
  return r.ok ? NextResponse.json({ success: true, options: r.options }, { headers: NO_STORE })
    : NextResponse.json({ success: false, error: r.error }, { status: 400, headers: NO_STORE });
}
