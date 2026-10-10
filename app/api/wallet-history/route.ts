import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Own ledger only. The ?username= parameter is ignored.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const { data: transactions, error } = await supabaseAdmin
      .from("wallet_transactions")
      .select("*")
      .eq("username", auth.user.username)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    return NextResponse.json({ success: true, transactions }, { headers: NO_STORE });
  } catch (err) {
    console.error("WALLET HISTORY ERROR:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json(
      { success: false, message: "Could not load history." },
      { status: 500, headers: NO_STORE }
    );
  }
}
