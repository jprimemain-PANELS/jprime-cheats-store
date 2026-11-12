import { NextRequest, NextResponse } from "next/server";
import { rateLimit, requireUser } from "@/lib/auth";
import { upgradeToReseller } from "@/lib/upgrade-reseller";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (!rateLimit(`upg:${auth.tenant.id}:${auth.user.username}`, 5, 10 * 60_000)) {
    return NextResponse.json({ success: false, error: "Too many tries. Wait a few minutes." }, { status: 429, headers: NO_STORE });
  }
  const r = await upgradeToReseller(auth.tenant.id, { id: String(auth.user.id ?? ""), username: auth.user.username, role: String(auth.user.role ?? "") });
  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status, headers: NO_STORE });
  return NextResponse.json({ success: true, price: r.price, balance: r.balance }, { headers: NO_STORE });
}
