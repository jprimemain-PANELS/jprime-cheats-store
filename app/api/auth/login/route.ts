import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  attachSessionCookie,
  clientIp,
  hashPassword,
  isHashedPassword,
  isSameOrigin,
  rateLimit,
  verifyPassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const INVALID = { success: false, error: "Invalid username or password" };

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ success: false, error: "Cross-origin request blocked." }, { status: 403, headers: NO_STORE });
    }

    const body = await request.json().catch(() => ({}));
    const identifier = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");

    if (!identifier || !password || identifier.length > 100 || password.length > 200) {
      return NextResponse.json(INVALID, { status: 400, headers: NO_STORE });
    }

    const ip = clientIp(request);
    if (
      !rateLimit(`login:ip:${ip}`, 20, 10 * 60_000) ||
      !rateLimit(`login:id:${identifier.toLowerCase()}`, 10, 10 * 60_000)
    ) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Try again later." },
        { status: 429, headers: NO_STORE }
      );
    }

    // Separate parameterised lookups (no string-built filters).
    const [byName, byMobile] = await Promise.all([
      supabaseAdmin.from("users").select("*").eq("username", identifier).limit(5),
      supabaseAdmin.from("users").select("*").eq("mobile_number", identifier).limit(5),
    ]);

    if (byName.error || byMobile.error) {
      console.error("LOGIN LOOKUP ERROR");
      return NextResponse.json(
        { success: false, error: "Login unavailable. Try again." },
        { status: 500, headers: NO_STORE }
      );
    }

    const candidates: any[] = [...(byName.data || []), ...(byMobile.data || [])];
    const user = candidates.find((u) => verifyPassword(password, String(u.password ?? "")));

    if (!user) {
      return NextResponse.json(INVALID, { status: 401, headers: NO_STORE });
    }

    let storedPassword = String(user.password);

    // Lazy migration: upgrade legacy plaintext passwords to scrypt on successful login.
    if (!isHashedPassword(storedPassword)) {
      const hashed = hashPassword(password);
      const { error: upgradeError } = await supabaseAdmin
        .from("users")
        .update({ password: hashed })
        .eq("username", user.username)
        .eq("password", storedPassword);

      if (upgradeError) {
        console.error("PASSWORD UPGRADE SKIPPED:", upgradeError.message);
      } else {
        storedPassword = hashed;
      }
    }

    const response = NextResponse.json(
      {
        success: true,
        user: { username: user.username, email: user.email ?? null, role: user.role || "user" },
      },
      { headers: NO_STORE }
    );
    return attachSessionCookie(response, String(user.username), storedPassword);
  } catch (error) {
    console.error("LOGIN ERROR:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { success: false, error: "Login unavailable. Try again." },
      { status: 500, headers: NO_STORE }
    );
  }
}
