import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const response = NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  return clearSessionCookie(
    response,
    request.headers.get("x-forwarded-host") || request.headers.get("host")
  );
}
