import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * DISABLED for security. This legacy endpoint was unauthenticated and could
 * hand out keys / spend supplier balance / write purchase records for anyone.
 * All purchases now go through /api/pay-via-wallet and /api/create-upi-order
 * (server-verified session + server-side price).
 */
function gone() {
  return NextResponse.json(
    { success: false, error: "This endpoint has been retired." },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}

export const GET = gone;
export const POST = gone;
