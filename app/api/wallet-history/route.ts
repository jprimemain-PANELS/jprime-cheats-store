import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json({ success: false, message: "Username required." }, { status: 400 });
    }

    const { data: transactions, error } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("username", username)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, transactions });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}