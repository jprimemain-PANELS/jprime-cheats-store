import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Returns ONLY the logged-in user's own purchase history (previously: everyone's).
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const { data, error } = await supabaseAdmin
      .from("purchase_history")
      .select("*")
      .eq("username", auth.user.username)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("GET PURCHASES ERROR:", error.message);
      return NextResponse.json(
        { success: false, error: "Could not load purchases." },
        { status: 500, headers: NO_STORE }
      );
    }

    return NextResponse.json({ success: true, purchases: data || [] }, { headers: NO_STORE });
  } catch {
    return NextResponse.json(
      { success: false, error: "Could not load purchases." },
      { status: 500, headers: NO_STORE }
    );
  }
}
