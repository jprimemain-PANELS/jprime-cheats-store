import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { clientIp, hashPassword, isSameOrigin, rateLimit } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ success: false, error: "Cross-origin request blocked." }, { status: 403, headers: NO_STORE });
    }

    if (!rateLimit(`signup:ip:${clientIp(request)}`, 10, 60 * 60_000)) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Try again later." },
        { status: 429, headers: NO_STORE }
      );
    }

    const body = await request.json().catch(() => ({}));
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");
    const email = String(body?.email ?? "").trim();
    const mobile = String(body?.mobile_number ?? "").trim();

    if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) {
      return NextResponse.json(
        { success: false, error: "Username must be 3-32 letters, numbers, . _ -" },
        { status: 400, headers: NO_STORE }
      );
    }
    if (password.length < 6 || password.length > 200) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters." },
        { status: 400, headers: NO_STORE }
      );
    }
    if (mobile.replace(/\D/g, "").length < 10 || mobile.length > 20) {
      return NextResponse.json(
        { success: false, error: "Enter valid mobile number" },
        { status: 400, headers: NO_STORE }
      );
    }
    if (email && (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return NextResponse.json(
        { success: false, error: "Enter a valid email." },
        { status: 400, headers: NO_STORE }
      );
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("users")
      .select("username")
      .eq("username", username)
      .limit(1);

    if (existingError) {
      return NextResponse.json({ success: false, error: "Signup unavailable." }, { status: 500, headers: NO_STORE });
    }
    if (existing && existing.length > 0) {
      return NextResponse.json({ success: false, error: "Username already exists" }, { status: 409, headers: NO_STORE });
    }

    // Role is ALWAYS "user" here. Browser-supplied roles are ignored.
    const { error } = await supabaseAdmin.from("users").insert([
      {
        username,
        password: hashPassword(password),
        email,
        mobile_number: mobile,
        role: "user",
      },
    ]);

    if (error) {
      console.error("SIGNUP INSERT ERROR:", error.message);
      return NextResponse.json({ success: false, error: "Could not create account." }, { status: 400, headers: NO_STORE });
    }

    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (error) {
    console.error("SIGNUP ERROR:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ success: false, error: "Signup unavailable." }, { status: 500, headers: NO_STORE });
  }
}
