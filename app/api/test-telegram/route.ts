import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { testAllTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Admin-only: sends a test message to every enabled Telegram destination.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const results = await testAllTelegram();
  if (results.length === 0) {
    return NextResponse.json({ success: false, error: "Telegram is not configured." }, { status: 500 });
  }
  return NextResponse.json({ success: results.every((r) => r.ok), results });
}
