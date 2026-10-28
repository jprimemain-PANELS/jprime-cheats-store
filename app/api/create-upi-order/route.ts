import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, rateLimit } from "@/lib/auth";
import { getTrustedQuote } from "@/lib/pricing";
import {
  createGatewayOrder,
  gatewayNeedsUtr,
  getActiveGatewayId,
  getGatewayConfig,
  isAmountAcceptable,
} from "@/lib/payment-gateway";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status, headers: NO_STORE });
}

function isMissingColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /column .*gateway|gateway.* column/i.test(error.message || "");
}

/**
 * Creates a UPI order on the ACTIVE gateway (Admin -> Payments).
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

    const gatewayId = await getActiveGatewayId();
    const cfg = await getGatewayConfig(gatewayId);
    if (!cfg.apiKey) {
      console.error(`${gatewayId} gateway API key is missing`);
      return fail("Payment gateway is not configured", 500);
    }

    const created = await createGatewayOrder(cfg, quote.price);
    if (!created.ok) return fail(created.error, created.httpStatus);
    const gatewayOrder = created.order;

    if (!isAmountAcceptable(quote.price, gatewayOrder.amount)) {
      console.error("Gateway amount out of range", { expected: quote.price, gatewayAmount: gatewayOrder.amount });
      return fail("Payment gateway returned an unexpected amount", 502);
    }

    const row = {
      username,
      product_name: productName,
      duration,
      amount: gatewayOrder.amountText,
      status: "pending",
      used: false,
      gateway_order_id: gatewayOrder.order_id,
      qr_url: gatewayOrder.qr_url || null,
      upi_link: gatewayOrder.upi_link || null,
      expires_at: gatewayOrder.expires_at || null,
    };

    let { error: insertError } = await supabaseAdmin.from("payment_orders").insert([{ ...row, gateway: gatewayId }]);

    if (insertError && isMissingColumn(insertError)) {
      if (gatewayId !== "xyz") {
        console.error("payment_orders.gateway column missing; run supabase/PAYMENT_GATEWAY_SWITCH.sql");
        return fail("Payment database needs the gateway update. Contact the store admin.", 500);
      }
      // xyz without the column: behave exactly like before.
      ({ error: insertError } = await supabaseAdmin.from("payment_orders").insert([row]));
    }

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
          amount: gatewayOrder.amountText,
          created_at: gatewayOrder.created_at,
          expires_at: gatewayOrder.expires_at,
          gateway: gatewayId,
          needs_utr: gatewayNeedsUtr(gatewayId),
        },
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error("CREATE UPI ORDER ERROR:", error instanceof Error ? error.message : "unknown");
    return fail("Unable to create the order", 500);
  }
}
