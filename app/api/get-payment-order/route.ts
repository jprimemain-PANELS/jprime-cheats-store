import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Returns a payment order ONLY to the user who created it.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const orderId = String(body?.order_id ?? "").trim();

    if (!orderId) {
      return NextResponse.json({ success: false, error: "Missing order ID" }, { status: 400, headers: NO_STORE });
    }

    const { data: order, error } = await supabaseAdmin
      .from("payment_orders")
      .select("gateway_order_id, username, amount, status, used, qr_url, upi_link, expires_at")
      .eq("gateway_order_id", orderId)
      .maybeSingle();

    if (error) {
      console.error("GET PAYMENT ORDER ERROR:", error.message);
      return NextResponse.json({ success: false, error: "Could not load payment order" }, { status: 500, headers: NO_STORE });
    }

    if (!order || order.username !== auth.user.username) {
      return NextResponse.json({ success: false, error: "Payment order not found" }, { status: 404, headers: NO_STORE });
    }

    return NextResponse.json(
      {
        success: true,
        order: {
          order_id: order.gateway_order_id,
          amount: order.amount,
          status: order.status,
          used: order.used,
          qr_url: order.qr_url,
          upi_link: order.upi_link,
          expires_at: order.expires_at,
        },
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error("GET PAYMENT ORDER SERVER ERROR:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500, headers: NO_STORE });
  }
}
