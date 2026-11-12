import { NextRequest, NextResponse } from "next/server";
import { tdb } from "@/lib/tenant-db";
import { canTransact, OWNER_TENANT_ID, SUSPENDED_MESSAGE } from "@/lib/tenant";
import { requireUser, rateLimit } from "@/lib/auth";
import { getTrustedQuote } from "@/lib/pricing";
import {
  createGatewayOrder,
  gatewayNeedsUtr,
  getActiveGatewayId,
  tenantGatewayReady,
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
// Direct product payment by UPI is TURNED OFF: a failed delivery after payment could not be refunded to a wallet.
// Customers add money to their wallet (wallet top-up still uses the UPI gateway) and buy from the wallet, where failures auto-refund.
// Set ALLOW_DIRECT_UPI=1 to switch it back on (not recommended).
const DIRECT_UPI_ON = process.env.ALLOW_DIRECT_UPI === "1";

export async function POST(request: NextRequest) {
  if (!DIRECT_UPI_ON) return fail("Direct UPI payment is turned off. Add money to your wallet, then buy from your wallet.", 410);
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const { username, role } = auth.user;
    if (!canTransact(auth.tenant)) return fail(SUSPENDED_MESSAGE, 403);
    // Only the owner store has a configured payment gateway today; co-admin gateways are the next phase.
    if (auth.tenant.id !== OWNER_TENANT_ID && !(await tenantGatewayReady(auth.tenant.id))) return fail("Payments are not set up for this store yet. Please contact the store owner.", 503);

    if (!rateLimit(`upi-create:${auth.tenant.id}:${username}`, 10, 60_000)) {
      return fail("Too many requests. Please wait a moment.", 429);
    }

    const body = await request.json().catch(() => ({}));
    const productName = String(body?.product_name ?? "").trim();
    const duration = String(body?.duration ?? "").trim();

    if (!productName || !duration) return fail("Missing required order information", 400);

    const coupon = String(body?.coupon ?? "").trim().slice(0, 40);

    const quote = await getTrustedQuote({ tenantId: auth.tenant.id, username, role, productName, duration, coupon });
    if (!quote.ok) return fail(quote.error, quote.httpStatus);
    if (quote.status === "MAINTENANCE") {
      return fail("This product is under maintenance. Please check back soon.", 409);
    }

    const gatewayId = await getActiveGatewayId(auth.tenant.id);
    const cfg = await getGatewayConfig(gatewayId, false, auth.tenant.id);
    if (!cfg.apiKey) {
      console.error(`${gatewayId} gateway API key is missing`);
      return fail("Payment gateway is not configured", 500);
    }

    const created = await createGatewayOrder(cfg, quote.price, auth.tenant.kind === "owner" ? undefined : auth.tenant.brandName);
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

    const db = tdb(auth.tenant.id);
    let { error: insertError } = await db.from("payment_orders").insert([{ ...row, gateway: gatewayId }]);

    if (insertError && isMissingColumn(insertError)) {
      if (gatewayId !== "xyz") {
        console.error("payment_orders.gateway column missing; run supabase/PAYMENT_GATEWAY_SWITCH.sql");
        return fail("Payment database needs the gateway update. Contact the store admin.", 500);
      }
      // xyz without the column: behave exactly like before.
      ({ error: insertError } = await db.from("payment_orders").insert([row]));
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
