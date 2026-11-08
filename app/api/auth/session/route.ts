import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Retired. This route belonged to an older, tenant-unaware session system
 * (cookie "jprime_session", username-only lookup). Sessions are now issued and
 * refreshed only by /api/auth/login and /api/auth/heartbeat (lib/auth.ts).
 */
export async function POST() {
  return NextResponse.json(
    { success: false, error: "Gone. Use /api/auth/heartbeat." },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}
