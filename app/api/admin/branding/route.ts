import { NextRequest, NextResponse } from "next/server";
import { rateLimit, requireTenantAdmin } from "@/lib/auth";
import { getTheme, saveBranding } from "@/lib/tenant-admin";
import { DEFAULT_THEME, PRESETS, FONTS } from "@/lib/theme";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/** Store admin (owner on the owner store, co-admin on their own). Always the CURRENT store only. */
export async function GET(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  const theme = (await getTheme(auth.tenant.id)) ?? DEFAULT_THEME;
  return NextResponse.json({
    success: true, brandName: auth.tenant.brandName, telegram: auth.tenant.telegramUsername, kind: auth.tenant.kind, theme,
    presets: PRESETS, fonts: Object.fromEntries(Object.entries(FONTS).map(([k, v]) => [k, v.label])),
  }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  if (!rateLimit(`branding:${auth.user.username}:${auth.tenant.id}`, 30, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests." }, { status: 429, headers: NO_STORE });
  }
  const b = await request.json().catch(() => ({}));
  const r = await saveBranding(auth.tenant, { id: auth.user.id, username: auth.user.username }, b);
  return r.ok
    ? NextResponse.json({ success: true, theme: r.theme }, { headers: NO_STORE })
    : NextResponse.json({ success: false, error: r.error }, { status: 400, headers: NO_STORE });
}
