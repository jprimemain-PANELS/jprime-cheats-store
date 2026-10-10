import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  return clearSessionCookie(
    NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } })
  );
}
