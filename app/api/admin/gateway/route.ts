import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, rateLimit } from "@/lib/auth";
import {
  getGatewayAdminView,
  isGatewayId,
  saveGatewayConfig,
  setActiveGateway,
  testGateway,
} from "@/lib/payment-gateway";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status, headers: NO_STORE });
}

/**
 * GET  /api/admin/gateway -> current gateway settings (API keys are NEVER returned, only a masked hint).
 * POST /api/admin/gateway -> { action: "set_active" | "save_config" | "test", gateway, ... }
 * Admin session required on every call.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const view = await getGatewayAdminView();
    return NextResponse.json({ success: true, ...view }, { headers: NO_STORE });
  } catch (e) {
    console.error("ADMIN GATEWAY READ ERROR:", e instanceof Error ? e.message : "unknown");
    return fail("Could not load gateway settings.", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!rateLimit(`admin-gateway:${auth.user.username}`, 30, 60_000)) {
    return fail("Too many requests. Please wait a moment.", 429);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "");
    const gateway = body?.gateway;

    if (!isGatewayId(gateway)) return fail("Unknown gateway.");

    if (action === "set_active") {
      const result = await setActiveGateway(gateway);
      if (!result.ok) return fail(result.error, 500);
      console.warn(`ADMIN ${auth.user.username} switched the active payment gateway to ${gateway}`);
      return NextResponse.json({ success: true }, { headers: NO_STORE });
    }

    if (action === "save_config") {
      const result = await saveGatewayConfig(gateway, {
        apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
        clearKey: body.clearKey === true,
        createUrl: typeof body.createUrl === "string" ? body.createUrl : undefined,
        verifyUrl: typeof body.verifyUrl === "string" ? body.verifyUrl : undefined,
        resetUrls: body.resetUrls === true,
      });
      if (!result.ok) return fail(result.error, result.error.startsWith("Settings table") ? 500 : 400);
      console.warn(`ADMIN ${auth.user.username} updated the ${gateway} gateway settings`);
      return NextResponse.json({ success: true }, { headers: NO_STORE });
    }

    if (action === "test") {
      const result = await testGateway(gateway);
      return NextResponse.json({ success: true, ok: result.ok, message: result.message }, { headers: NO_STORE });
    }

    return fail("Unknown action.");
  } catch (e) {
    console.error("ADMIN GATEWAY ACTION ERROR:", e instanceof Error ? e.message : "unknown");
    return fail("Gateway action failed.", 500);
  }
}
