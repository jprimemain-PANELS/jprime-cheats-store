import { NextRequest, NextResponse } from "next/server";
import { clientIp, isSameOrigin, rateLimit } from "@/lib/auth";
import { currentTenant } from "@/lib/tenant";
import { redeemResetCode } from "@/lib/user-admin";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/** Forgot password, step 2: username + one-time code from the store admin + new password. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ success: false, error: "Blocked." }, { status: 403, headers: NO_STORE });
  const tenant = await currentTenant();
  if (!tenant) return NextResponse.json({ success: false, error: "Store not found." }, { status: 404, headers: NO_STORE });
  const b = await request.json().catch(() => ({}));
  const username = String(b?.username ?? "").trim();
  if (!rateLimit(`reset:ip:${clientIp(request)}`, 10, 10 * 60_000) || !rateLimit(`reset:user:${tenant.id}:${username.toLowerCase()}`, 10, 60 * 60_000)) {
    return NextResponse.json({ success: false, error: "Too many tries. Try again later." }, { status: 429, headers: NO_STORE });
  }
  const r = await redeemResetCode(tenant.id, username, String(b?.code ?? ""), String(b?.password ?? ""));
  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 400, headers: NO_STORE });
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
