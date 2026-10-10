import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, rateLimit } from "@/lib/auth";
import { getTrustedQuote } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const FP_CREATE_ORDER_URL = "https://xyzcheats.com/gateway/create_order.php";
const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status, headers: NO_STORE });
}

/**
 * Creates a UPI order.
 * - Buyer = authenticated session user (username in the body is ignored).
 * - Amount = trusted server-side price (amount in the body is ignored).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const { username, role } = auth.user;

    if (!rateLimit(`upi-create:${username}`, 10, 60_000)) {
      return fail("Too many requests. Please wait a moment.", 429);
    }

    const body = await request.json().catch(() => ({}));
    const productName = String(body?.product_name ?? "").trim();
    const duration = String(body?.duration ?? "").trim();

    if (!productName || !duration) return fail("Missing required order information", 400);

    const quote = await getTrustedQuote({ username, role, productName, duration });
    if (!quote.ok) return fail(quote.error, quote.httpStatus);
    if (quote.status === "MAINTENANCE") {
      return fail("This product is under maintenance. Please check back soon.", 409);
    }

    const apiKey = process.env.FP_API_KEY;
    if (!apiKey) {
      console.error("FP_API_KEY is missing");
      return fail("Payment gateway is not configured", 500);
    }

    const gatewayUrl = new URL(FP_CREATE_ORDER_URL);
    gatewayUrl.searchParams.set("amount", String(quote.price));
    gatewayUrl.searchParams.set("api_key", apiKey);

    const gatewayResponse = await fetch(gatewayUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    let gatewayData: any;
    try {
      gatewayData = JSON.parse(await gatewayResponse.text());
    } catch {
      console.error("Invalid gateway response (create order)");
      return fail("Payment gateway returned an invalid response", 502);
    }

    if (
      !gatewayResponse.ok ||
      gatewayData?.status !== "success" ||
      !gatewayData?.data?.order_id ||
      !gatewayData?.data?.qr_url
    ) {
      console.error("Gateway order creation failed, HTTP", gatewayResponse.status);
      return fail("Failed to create payment order", 502);
    }

    const gatewayOrder = gatewayData.data;

    // The gateway may add paise to make the amount unique; it must never be below the price.
    const gatewayAmount = Number(gatewayOrder.amount);
    if (
      !Number.isFinite(gatewayAmount) ||
      gatewayAmount < quote.price - 0.001 ||
      gatewayAmount >= quote.price + 1
    ) {
      console.error("Gateway amount out of range", { expected: quote.price, gatewayAmount });
      return fail("Payment gateway returned an unexpected amount", 502);
    }

    const { error: insertError } = await supabaseAdmin.from("payment_orders").insert([
      {
        username,
        product_name: productName,
        duration,
        amount: String(gatewayOrder.amount),
        status: "pending",
        used: false,
        gateway_order_id: String(gatewayOrder.order_id),
        qr_url: gatewayOrder.qr_url || null,
        upi_link: gatewayOrder.upi_link || null,
        expires_at: gatewayOrder.expires_at || null,
      },
    ]);

    if (insertError) {
      console.error("PAYMENT ORDER INSERT ERROR:", insertError.message);
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
    console.error("CREATE UPI ORDER ERROR:", error instanceof Error ? error.message : "unknown");
    return fail("Unable to create the order", 500);
  }
}
