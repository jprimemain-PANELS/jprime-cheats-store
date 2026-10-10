import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getOrCreateBalance } from "@/lib/wallet";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// A user can only ever read THEIR OWN wallet. Any username in the body is ignored.
async function handle(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const balance = await getOrCreateBalance(auth.user.username);
  if (balance === null) {
    return NextResponse.json(
      { success: false, error: "Could not load wallet." },
      { status: 500, headers: NO_STORE }
    );
  }

  return NextResponse.json(
    {
      success: true,
      balance,
      username: auth.user.username,
      role: auth.user.role,
    },
    { headers: NO_STORE }
  );
}

export const POST = handle;
export const GET = handle;
