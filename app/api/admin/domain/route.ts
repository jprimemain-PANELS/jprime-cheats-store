import { NextRequest, NextResponse } from "next/server";
import { rateLimit, requireTenantAdmin } from "@/lib/auth";
import { checkCustomDomainDns, domainState, removeCustomDomain, requestCustomDomain } from "@/lib/domains";
import { hostFor } from "@/lib/tenant-admin";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO_STORE });

/** Store admin only; always the CURRENT store (tenant comes from the verified host + session). */
export async function GET(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  const state = await domainState(auth.tenant.id);
  return NextResponse.json({ success: true, kind: auth.tenant.kind, slugHost: hostFor(auth.tenant.slug), ...state }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  if (auth.tenant.kind !== "coadmin") return fail("The owner store already has its own domain.", 403);
  if (!rateLimit(`domain:${auth.user.username}:${auth.tenant.id}`, 20, 60_000)) return fail("Too many requests.", 429);
  const b = await request.json().catch(() => ({}));
  const actor = { id: auth.user.id, username: auth.user.username };
  const action = String(b?.action ?? "");
  let r: any;
  if (action === "request") r = await requestCustomDomain(auth.tenant, actor, b?.domain);
  else if (action === "check") r = await checkCustomDomainDns(auth.tenant, actor);
  else if (action === "remove") r = await removeCustomDomain(auth.tenant, actor);
  else return fail("Unknown action.");
  if (!r.ok) return fail(r.error || "Failed.");
  return NextResponse.json({ success: true, ...r }, { headers: NO_STORE });
}
