import { NextRequest, NextResponse } from "next/server";
import { rateLimit, requireTenantAdmin } from "@/lib/auth";
import { getStoreOptions } from "@/lib/store-options";
import { MAX_TRIAL_DAYS, getPlanConfig, savePlanConfig } from "@/lib/plan-settings";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO_STORE });

/**
 * Subscription prices + free-trial days that THIS store sells.
 * Owner store: the main website's plans. A co-admin store: only when the owner chose "their own web" for it
 * (its resellers' sub-stores pay this store). Always the verified current store, never from the body.
 */
async function allowed(auth: { tenant: { id: string; kind: string } }) {
  if (auth.tenant.kind === "owner") return true;
  const o = await getStoreOptions(auth.tenant.id);
  return o.resellerLaunch === true && o.launchMode === "own";
}

export async function GET(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  if (!(await allowed(auth))) return fail("Plan prices are managed by the platform owner for this store.", 403);
  const c = await getPlanConfig(auth.tenant.id);
  return NextResponse.json({ success: true, ...c, maxTrialDays: MAX_TRIAL_DAYS }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  if (!(await allowed(auth))) return fail("Plan prices are managed by the platform owner for this store.", 403);
  if (!rateLimit(`plans:${auth.user.username}:${auth.tenant.id}`, 20, 60_000)) return fail("Too many requests.", 429);
  const b = await request.json().catch(() => ({}));
  const r = await savePlanConfig(auth.tenant.id, b);
  return r.ok ? NextResponse.json({ success: true, ...r.config }, { headers: NO_STORE }) : fail(r.error);
}
