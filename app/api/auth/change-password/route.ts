import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie, rateLimit, requireUser } from "@/lib/auth";
import { changeOwnPassword } from "@/lib/user-admin";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO_STORE });

/** Any logged-in user (customer, reseller, store admin, owner) changes THEIR OWN password. */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (!rateLimit(`chpw:${auth.tenant.id}:${auth.user.username}`, 6, 10 * 60_000)) return fail("Too many tries. Wait a few minutes.", 429);
  const b = await request.json().catch(() => ({}));
  const r = await changeOwnPassword(auth.tenant.id, auth.user.id, String(b?.current ?? ""), String(b?.next ?? ""));
  if (!r.ok) return fail(r.error);
  // the session is tied to the password, so give THIS browser a fresh one (other devices must log in again)
  const res = NextResponse.json({ success: true }, { headers: NO_STORE });
  return attachSessionCookie(res, r.username, r.hash, r.id, request.headers.get("x-forwarded-host") || request.headers.get("host"), auth.tenant.id);
}
