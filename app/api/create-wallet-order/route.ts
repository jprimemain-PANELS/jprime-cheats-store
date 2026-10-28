import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, rateLimit } from "@/lib/auth";
import {
  createGatewayOrder,
  gatewayNeedsUtr,
  getActiveGatewayId,
  getGatewayConfig,
  isAmountAcceptable,
} from "@/lib/payment-gateway";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const MIN_TOPUP = 1;
const MAX_TOPUP = 50000;

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status, headers: NO_STORE });
}

function isMissingColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /column .*gateway|gateway.* column/i.test(error.message || "");
}

/**
 * Wallet top-up order on the ACTIVE gateway (Admin -> Payments). The deposit is always
 * tied to the logged-in user; any username sent by the browser is ignored.
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

    const gatewayId = await getActiveGatewayId();
    const cfg = await getGatewayConfig(gatewayId);
    if (!cfg.apiKey) {
      console.error(`${gatewayId} gateway API key is missing`);
      return fail("Payment gateway is not configured", 500);
    }

    const created = await createGatewayOrder(cfg, amount);
    if (!created.ok) return fail(created.error, created.httpStatus);
    const gatewayOrder = created.order;

    if (!isAmountAcceptable(amount, gatewayOrder.amount)) {
      console.error("Gateway wallet amount out of range", { amount, gatewayAmount: gatewayOrder.amount });
      return fail("Payment gateway returned an unexpected amount", 502);
    }

    const row = {
      username,
      amount: gatewayOrder.amountText,
      gateway_order_id: gatewayOrder.order_id,
      mobile_number: mobile,
      status: "pending",
    };

    let { error: insertError } = await supabaseAdmin.from("deposit_history").insert([{ ...row, gateway: gatewayId }]);

    if (insertError && isMissingColumn(insertError)) {
      if (gatewayId !== "xyz") {
        console.error("deposit_history.gateway column missing; run supabase/PAYMENT_GATEWAY_SWITCH.sql");
        return fail("Payment database needs the gateway update. Contact the store admin.", 500);
      }
      ({ error: insertError } = await supabaseAdmin.from("deposit_history").insert([row]));
    }

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
    console.error("CREATE WALLET ORDER ERROR:", error instanceof Error ? error.message : "unknown");
    return fail("Unable to create the order", 500);
  }
}
