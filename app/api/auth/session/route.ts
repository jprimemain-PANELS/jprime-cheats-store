import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { clearSessionCookie, createSessionToken, readSession, setSessionCookie } from "@/lib/server-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = readSession(request);
  if (!session) {
    const response = NextResponse.json({ success: false, authenticated: false, error: "Session expired. Please log in again." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    clearSessionCookie(response);
    return response;
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("username")
    .eq("username", session.username)
    .maybeSingle();

  if (error || !user) {
    const response = NextResponse.json({ success: false, authenticated: false, error: "Session expired. Please log in again." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    clearSessionCookie(response);
    return response;
  }

  const token = createSessionToken({ ...session, lastActivityAt: Date.now() });
  if (!token) {
    const response = NextResponse.json({ success: false, authenticated: false, error: "Session security is not configured." }, { status: 503 });
    clearSessionCookie(response);
    return response;
  }
  const response = NextResponse.json({ success: true, authenticated: true }, { headers: { "Cache-Control": "no-store" } });
  setSessionCookie(response, token);
  return response;
}
