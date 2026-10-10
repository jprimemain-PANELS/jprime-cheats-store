import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, rateLimit } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FP_CREATE_ORDER_URL = "https://xyzcheats.com/gateway/create_order.php";
const NO_STORE = { "Cache-Control": "no-store" };
const MIN_TOPUP = 1;
const MAX_TOPUP = 50000;

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status, headers: NO_STORE });
}

/**
 * Wallet top-up order. The deposit is always tied to the logged-in user;
 * any username sent by the browser is ignored.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const { username } = auth.user;

    if (!rateLimit(`wallet-topup:${username}`, 10, 60_000)) {
      return fail("Too many requests. Please wait a moment.", 429);
    }

    const body = await request.json().catch(() => ({}));
    const amount = Math.round(Number(body?.amount) * 100) / 100;
    const mobile = String(body?.mobile_number ?? "").trim().slice(0, 20);

    if (!Number.isFinite(amount) || amount < MIN_TOPUP || amount > MAX_TOPUP) {
      return fail(`Amount must be between ₹${MIN_TOPUP} and ₹${MAX_TOPUP}.`, 400);
    }
    if (!mobile) return fail("Missing required order information", 400);

    const apiKey = process.env.FP_API_KEY;
    if (!apiKey) {
      console.error("FP_API_KEY is missing");
      return fail("Payment gateway is not configured", 500);
    }

    const gatewayUrl = new URL(FP_CREATE_ORDER_URL);
    gatewayUrl.searchParams.set("amount", String(amount));
    gatewayUrl.searchParams.set("api_key", apiKey);

    const gatewayResponse = await fetch(gatewayUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    let gatewayData: any;
    try {
      gatewayData = JSON.parse(await gatewayResponse.text());
    } catch {
      return fail("Payment gateway returned an invalid response", 502);
    }

    if (
      !gatewayResponse.ok ||
      gatewayData?.status !== "success" ||
      !gatewayData?.data?.order_id ||
      !gatewayData?.data?.qr_url
    ) {
      console.error("Gateway wallet order failed, HTTP", gatewayResponse.status);
      return fail("Failed to create payment order", 502);
    }

    const gatewayOrder = gatewayData.data;
    const gatewayAmount = Number(gatewayOrder.amount);

    if (!Number.isFinite(gatewayAmount) || gatewayAmount < amount - 0.001 || gatewayAmount >= amount + 1) {
      console.error("Gateway wallet amount out of range", { amount, gatewayAmount });
      return fail("Payment gateway returned an unexpected amount", 502);
    }

    const { error: insertError } = await supabaseAdmin.from("deposit_history").insert([
      {
        username,
        amount: String(gatewayOrder.amount),
        gateway_order_id: String(gatewayOrder.order_id),
        mobile_number: mobile,
        status: "pending",
      },
    ]);

    if (insertError) {
      console.error("DEPOSIT ORDER INSERT ERROR:", insertError.message);
      return fail("Could not save the payment order", 500);
    }

    return NextResponse.json(
      {
        success: true,
        payment: {
          order_id: gatewayOrder.order_id,
          qr_url: gatewayOrder.qr_url,
          upi_link: gatewayOrder.upi_link,
          upi_id: gatewayOrder.upi_id,
          amount: gatewayOrder.amount,
          created_at: gatewayOrder.created_at,
          expires_at: gatewayOrder.expires_at,
        },
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error("CREATE WALLET ORDER ERROR:", error instanceof Error ? error.message : "unknown");
    return fail("Unable to create the order", 500);
  }
}
