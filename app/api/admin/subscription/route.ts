import { NextRequest, NextResponse } from "next/server";
import { rateLimit, requireTenantAdmin } from "@/lib/auth";
import { PLANS, TRIAL_DAYS, linkWalletAccount, subscribe, subscriptionState } from "@/lib/subscription";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO_STORE });

/** Store admin only; always the CURRENT store. The owner store has no plan. */
export async function GET(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  if (auth.tenant.kind !== "coadmin") return NextResponse.json({ success: true, owner: true }, { headers: NO_STORE });
  const state = await subscriptionState(auth.tenant.id);
  return NextResponse.json({ success: true, owner: false, ...state, plans: PLANS, trialDays: TRIAL_DAYS }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  if (auth.tenant.kind !== "coadmin") return fail("The main store has no plan.", 403);
  if (!rateLimit(`sub:${auth.user.username}:${auth.tenant.id}`, 10, 60_000)) return fail("Too many requests.", 429);
  // A store the OWNER suspended cannot be revived by paying. Only an expired plan can be renewed.
  if (auth.tenant.status === "suspended" && !auth.tenant.subscriptionExpired) return fail("This store is suspended. Contact the platform owner.", 403);
  const b = await request.json().catch(() => ({}));
  if (b?.action === "link") {
    if (!rateLimit(`sub-link:${auth.user.username}:${auth.tenant.id}`, 5, 10 * 60_000)) return fail("Too many tries. Wait a few minutes.", 429);
    const l = await linkWalletAccount(auth.tenant, String(b?.username ?? ""), String(b?.password ?? ""), { id: auth.user.id, username: auth.user.username });
    return l.ok ? NextResponse.json({ success: true }, { headers: NO_STORE }) : fail(l.error);
  }
  const r = await subscribe(auth.tenant, String(b?.plan ?? ""), { id: auth.user.id, username: auth.user.username });
  if (!r.ok) return fail(r.error);
  return NextResponse.json({ success: true, expiresAt: r.expiresAt, balance: r.balance }, { headers: NO_STORE });
}
