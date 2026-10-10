import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Who am I? Answer comes ONLY from the verified session cookie.
export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json(
    user
      ? { success: true, user: { username: user.username, email: user.email, role: user.role } }
      : { success: false, user: null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
