import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, rateLimit } from "@/lib/auth";
import {
  detectTelegramChats,
  getTelegramAdminView,
  importEnvDestination,
  saveTelegramDestinations,
  testTelegramDestination,
} from "@/lib/telegram";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status, headers: NO_STORE });
}

/**
 * GET  /api/admin/telegram -> destinations (bot tokens are NEVER returned, only a masked hint)
 * POST /api/admin/telegram -> { action: "save" | "test" | "detect" | "import_env", ... }
 * Admin session required on every call.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const view = await getTelegramAdminView();
    return NextResponse.json({ success: true, ...view }, { headers: NO_STORE });
  } catch (e) {
    console.error("ADMIN TELEGRAM READ ERROR:", e instanceof Error ? e.message : "unknown");
    return fail("Could not load Telegram settings.", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!rateLimit(`admin-telegram:${auth.user.username}`, 40, 60_000)) {
    return fail("Too many requests. Please wait a moment.", 429);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "save") {
      const result = await saveTelegramDestinations(body?.destinations);
      if (!result.ok) return fail(result.error, result.error.startsWith("Settings table") ? 500 : 400);
      console.warn(`ADMIN ${auth.user.username} updated the Telegram notification settings`);
      return NextResponse.json({ success: true }, { headers: NO_STORE });
    }

    if (action === "import_env") {
      const result = await importEnvDestination();
      if (!result.ok) return fail(result.error);
      return NextResponse.json({ success: true }, { headers: NO_STORE });
    }

    if (action === "test") {
      const result = await testTelegramDestination(String(body?.id || ""), typeof body?.text === "string" ? body.text : undefined);
      return NextResponse.json({ success: true, ok: result.ok, message: result.message }, { headers: NO_STORE });
    }

    if (action === "detect") {
      const result = await detectTelegramChats({
        id: typeof body?.id === "string" ? body.id : undefined,
        bot_token: typeof body?.bot_token === "string" ? body.bot_token : undefined,
      });
      return NextResponse.json({ success: true, ...result }, { headers: NO_STORE });
    }

    return fail("Unknown action.");
  } catch (e) {
    console.error("ADMIN TELEGRAM ACTION ERROR:", e instanceof Error ? e.message : "unknown");
    return fail("Telegram action failed.", 500);
  }
}