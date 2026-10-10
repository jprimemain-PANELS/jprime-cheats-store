import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { attachSessionCookie, getSessionUser, isSameOrigin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Refresh the signed session only after a valid session and same-origin request. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { success: false, error: "Cross-origin request blocked." },
      { status: 403, headers: NO_STORE }
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Session expired. Please log in again." },
      { status: 401, headers: NO_STORE }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("password")
    .eq("username", user.username)
    .maybeSingle();

  if (error || !data || typeof data.password !== "string") {
    return NextResponse.json(
      { success: false, error: "Session could not be refreshed." },
      { status: 401, headers: NO_STORE }
    );
  }

  const response = NextResponse.json({ success: true }, { headers: NO_STORE });
  return attachSessionCookie(response, user.username, data.password);
}
