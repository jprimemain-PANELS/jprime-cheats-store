import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth";
import { gatewayNeedsUtr, resolveGatewayId } from "@/lib/payment-gateway";

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

    const baseColumns = "gateway_order_id, username, amount, status, used, qr_url, upi_link, expires_at";

    // Try with the gateway column first; older databases without it still work (treated as xyz).
    let { data: order, error } = await supabaseAdmin
      .from("payment_orders")
      .select(`${baseColumns}, gateway`)
      .eq("gateway_order_id", orderId)
      .maybeSingle();

    if (error && (error.code === "42703" || error.code === "PGRST204" || /gateway/i.test(error.message || ""))) {
      ({ data: order, error } = (await supabaseAdmin
        .from("payment_orders")
        .select(baseColumns)
        .eq("gateway_order_id", orderId)
        .maybeSingle()) as any);
    }

    if (error) {
      console.error("GET PAYMENT ORDER ERROR:", error.message);
      return NextResponse.json({ success: false, error: "Could not load payment order" }, { status: 500, headers: NO_STORE });
    }

    if (!order || (order as any).username !== auth.user.username) {
      return NextResponse.json({ success: false, error: "Payment order not found" }, { status: 404, headers: NO_STORE });
    }

    const o: any = order;
    const gateway = resolveGatewayId(o.gateway);

    return NextResponse.json(
      {
        success: true,
        order: {
          order_id: o.gateway_order_id,
          amount: o.amount,
          status: o.status,
          used: o.used,
          qr_url: o.qr_url,
          upi_link: o.upi_link,
          expires_at: o.expires_at,
          gateway,
          needs_utr: gatewayNeedsUtr(gateway),
        },
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error("GET PAYMENT ORDER SERVER ERROR:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500, headers: NO_STORE });
  }
}