import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, requireUser } from "@/lib/auth";
import { checkSlug } from "@/lib/tenant-admin";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/** GET /api/tenant/slug-check?slug=andrews — logged-in users only, rate limited. */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (!rateLimit(`slug:${clientIp(request)}`, 30, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests." }, { status: 429, headers: NO_STORE });
  }
  const r = await checkSlug(request.nextUrl.searchParams.get("slug") ?? "");
  return NextResponse.json({ success: true, ...r }, { headers: NO_STORE });
}
