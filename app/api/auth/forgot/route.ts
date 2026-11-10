import { NextRequest, NextResponse } from "next/server";
import { clientIp, isSameOrigin, rateLimit } from "@/lib/auth";
import { currentTenant } from "@/lib/tenant";
import { recordForgot } from "@/lib/user-admin";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/** Forgot password: tells the store admin. Always the same answer, so nobody can learn which usernames exist. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ success: false, error: "Blocked." }, { status: 403, headers: NO_STORE });
  const tenant = await currentTenant();
  if (!tenant) return NextResponse.json({ success: false, error: "Store not found." }, { status: 404, headers: NO_STORE });
  if (!rateLimit(`forgot:ip:${clientIp(request)}`, 5, 10 * 60_000)) return NextResponse.json({ success: false, error: "Too many tries. Try again later." }, { status: 429, headers: NO_STORE });
  const b = await request.json().catch(() => ({}));
  try { await recordForgot(tenant.id, String(b?.username ?? "")); } catch {}
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
