import { NextRequest, NextResponse } from "next/server";
import { rateLimit, requireTenantAdmin } from "@/lib/auth";
import { getStoreTelegramView, saveStoreTelegram, testStoreTelegram } from "@/lib/store-telegram";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO_STORE });

/** Co-admin store alerts. The owner store keeps its own Telegram page (owner gets 403 here to avoid mix-ups). */
export async function GET(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  if (auth.tenant.kind !== "coadmin") return fail("Use the main Telegram settings.", 403);
  return NextResponse.json({ success: true, ...(await getStoreTelegramView(auth.tenant.id)) }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  if (auth.tenant.kind !== "coadmin") return fail("Use the main Telegram settings.", 403);
  if (!rateLimit(`store-tg:${auth.tenant.id}:${auth.user.username}`, 20, 60_000)) return fail("Too many requests.", 429);
  const b = await request.json().catch(() => ({}));
  if (b?.action === "test") {
    const r = await testStoreTelegram(auth.tenant.id);
    return NextResponse.json({ success: true, ok: r.ok, message: r.message }, { headers: NO_STORE });
  }
  const r = await saveStoreTelegram(auth.tenant.id, b);
  return r.ok ? NextResponse.json({ success: true }, { headers: NO_STORE }) : fail(r.error);
}
