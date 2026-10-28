import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { requireUser, rateLimit } from "@/lib/auth";
import { releaseProduct } from "@/lib/release-product";
import { sendTelegramPurchase } from "@/lib/telegram";
import {
  gatewayNeedsUtr,
  getGatewayConfig,
  normalizeBankReference,
  resolveGatewayId,
  verifyGatewayPayment,
} from "@/lib/payment-gateway";

/**
 * Mark a processing order as failed when key delivery fails.
 * This prevents an automatic retry from buying another supplier key.
 */
async function markDeliveryFailed(gatewayOrderId: string) {
  try {
    const { error } = await supabase
      .from("payment_orders")
      .update({ status: "delivery_failed" })
      .eq("gateway_order_id", gatewayOrderId)
      .eq("status", "processing");

    if (error) {
      console.error("FAILED TO MARK DELIVERY FAILURE:", {
        gatewayOrderId,
        error: error.message,
      });
    }
  } catch (error) {
    console.error("DELIVERY FAILURE STATUS EXCEPTION:", {
      gatewayOrderId,
      error,
    });
  }
}

/** Replay protection: a UTR that already settled any other order is rejected. */
async function utrAlreadyUsed(utr: string, gatewayOrderId: string): Promise<boolean> {
  for (const table of ["payment_orders", "deposit_history"] as const) {
    const { data: dup, error: dupError } = await supabase
      .from(table)
      .select("gateway_order_id")
      .eq("utr", utr)
      .neq("gateway_order_id", gatewayOrderId)
      .limit(1);

    if (!dupError && dup && dup.length > 0) return true;
  }
  return false;
}

function digitsOnly(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 0. Only a logged-in user may verify, and only their OWN order.
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    if (!rateLimit(`verify-pay:${auth.user.username}`, 20, 60_000)) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please wait a moment." },
        { status: 429 }
      );
    }

    // 1. Read and validate the request.
    const body = await request.json().catch(() => ({}));

    const gatewayOrderId = String(body?.gateway_order_id ?? "").trim();
    const utrInput = digitsOnly(body?.utr);

    if (!gatewayOrderId) {
      return NextResponse.json(
        { success: false, error: "Missing gateway order ID or UTR" },
        { status: 400 }
      );
    }

    // 2. Find the payment order.
    const { data: order, error: orderError } = await supabase
      .from("payment_orders")
      .select("*")
      .eq("gateway_order_id", gatewayOrderId)
      .maybeSingle();

    if (orderError) {
      console.error("ORDER LOOKUP ERROR:", orderError);

      return NextResponse.json(
        { success: false, error: "Could not load payment order" },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Payment order not found" },
        { status: 404 }
      );
    }

    // Ownership: never reveal that someone else's order exists.
    if (order.username !== auth.user.username) {
      return NextResponse.json(
        { success: false, error: "Payment order not found" },
        { status: 404 }
      );
    }

    // Which gateway created this order decides how it is verified.
    const gatewayId = resolveGatewayId((order as any).gateway);
    const needsUtr = gatewayNeedsUtr(gatewayId);

    if (needsUtr && !utrInput) {
      return NextResponse.json(
        { success: false, error: "Missing gateway order ID or UTR" },
        { status: 400 }
      );
    }

    // 3. If already successful, return its recorded key.
    if (order.status === "success") {
      let historyQuery = supabase
        .from("purchase_history")
        .select("key_code")
        .eq("username", order.username)
        .eq("product_name", order.product_name)
        .eq("duration", order.duration);

      // Avoid returning a key from an older purchase of the same product.
      if (order.created_at) {
        historyQuery = historyQuery.gte("created_at", String(order.created_at));
      }

      const { data: existingPurchase, error: historyLookupError } = await historyQuery
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (historyLookupError) {
        console.error("EXISTING KEY LOOKUP ERROR:", {
          gatewayOrderId,
          error: historyLookupError,
        });

        return NextResponse.json(
          {
            success: false,
            error: "Order is complete, but the recorded key could not be loaded. Contact support.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        status: "success",
        key: existingPurchase?.key_code || null,
      });
    }

    // Never automatically buy another key for an order already being processed.
    if (order.status === "processing") {
      return NextResponse.json(
        {
          success: false,
          status: "processing",
          error: "This order is already being processed. Please check again shortly.",
        },
        { status: 409 }
      );
    }

    // Failed delivery needs manual investigation, not another automatic purchase.
    if (order.status === "delivery_failed") {
      return NextResponse.json(
        {
          success: false,
          status: "delivery_failed",
          error: "This order needs support review. Do not submit another purchase for it.",
        },
        { status: 409 }
      );
    }

    // Only a pending order can be claimed for delivery.
    if (order.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          status: String(order.status || "unknown"),
          error: "This order can no longer be verified.",
        },
        { status: 409 }
      );
    }

    // 4. Gateway credentials for the gateway that created this order.
    const cfg = await getGatewayConfig(gatewayId);
    if (!cfg.apiKey) {
      console.error(`${gatewayId} gateway API key is missing`);

      return NextResponse.json(
        { success: false, error: "Payment gateway is not configured" },
        { status: 500 }
      );
    }

    // xyz: the UTR typed by the customer must not have settled another order.
    if (needsUtr && (await utrAlreadyUsed(utrInput, gatewayOrderId))) {
      return NextResponse.json(
        {
          success: false,
          status: "duplicate_utr",
          error: "This UTR was already used for another payment.",
        },
        { status: 409 }
      );
    }

    // 5. Verify the actual payment with the gateway.
    const verification = await verifyGatewayPayment(cfg, { orderId: gatewayOrderId, utr: utrInput });

    if (verification.state === "pending") {
      return NextResponse.json({ success: true, status: "pending" });
    }

    if (verification.state === "expired") {
      return NextResponse.json(
        {
          success: false,
          status: "expired",
          error: "This payment session expired. Please create a new order.",
        },
        { status: 410 }
      );
    }

    if (verification.state === "failed") {
      return NextResponse.json(
        {
          success: false,
          status: verification.gatewayDown ? "gateway_failed" : "failed",
          error: verification.message,
        },
        { status: verification.httpStatus }
      );
    }

    // verification.state === "paid"
    const payment = verification;

    // 6. Confirm the paid amount matches the order.
    const expectedAmount = Number(order.amount);
    const paidAmount = Number(payment.amount);

    if (
      !Number.isFinite(expectedAmount) ||
      !Number.isFinite(paidAmount) ||
      Math.abs(expectedAmount - paidAmount) > 0.001
    ) {
      console.error("PAYMENT AMOUNT MISMATCH:", {
        gatewayOrderId,
        expectedAmount,
        paidAmount,
      });

      return NextResponse.json(
        {
          success: false,
          status: "amount_mismatch",
          error: "Payment amount does not match the order",
        },
        { status: 409 }
      );
    }

    // The bank reference stored on the order.
    // xyz: what the customer typed (already verified by the gateway).
    // anuj: the reference the gateway reports for this exact order.
    let claimUtr = "";
    if (needsUtr) {
      claimUtr = utrInput;
    } else {
      claimUtr = normalizeBankReference(gatewayOrderId, payment.utr, { fallbackToOrder: false });
    }

    if (!needsUtr && claimUtr && (await utrAlreadyUsed(claimUtr, gatewayOrderId))) {
      console.error("DUPLICATE GATEWAY UTR:", { gatewayOrderId });
      return NextResponse.json(
        {
          success: false,
          status: "duplicate_utr",
          error: "This payment reference was already used for another payment. Contact support.",
        },
        { status: 409 }
      );
    }

    // 7. Atomically claim the order before calling either supplier.
    // Only one concurrent request can change the original status to processing.
    const originalStatus = String(order.status ?? "");

    if (!originalStatus) {
      return NextResponse.json(
        { success: false, error: "Payment order has no valid status" },
        { status: 409 }
      );
    }

    const claimFields: Record<string, string> = { status: "processing" };
    if (claimUtr) claimFields.utr = claimUtr;

    let claim = await supabase
      .from("payment_orders")
      .update(claimFields)
      .eq("gateway_order_id", gatewayOrderId)
      .eq("status", originalStatus)
      .select("gateway_order_id")
      .maybeSingle();

    if (claim.error) {
      if (claim.error.code === "23505") {
        return NextResponse.json(
          {
            success: false,
            status: "duplicate_utr",
            error: "This UTR was already used for another payment.",
          },
          { status: 409 }
        );
      }

      // utr column not present yet (SQL migration not applied): claim without it.
      if (claim.error.code === "42703" || /utr/i.test(claim.error.message || "")) {
        claim = await supabase
          .from("payment_orders")
          .update({ status: "processing" })
          .eq("gateway_order_id", gatewayOrderId)
          .eq("status", originalStatus)
          .select("gateway_order_id")
          .maybeSingle();
      }
    }

    const claimedOrder = claim.data;
    const claimError = claim.error;

    if (claimError) {
      console.error("ORDER CLAIM ERROR:", {
        gatewayOrderId,
        error: claimError,
      });

      return NextResponse.json(
        {
          success: false,
          error: "Could not safely begin key delivery. Please check the order before retrying.",
        },
        { status: 500 }
      );
    }

    if (!claimedOrder) {
      return NextResponse.json(
        {
          success: false,
          status: "processing",
          error: "This order has already been claimed or updated. Check the order before retrying.",
        },
        { status: 409 }
      );
    }

    // 8. Release the key from Seller 1, Seller 2, or local stock.
    type DeliveryResult = Awaited<ReturnType<typeof releaseProduct>>;
    let delivery: DeliveryResult;

    try {
      delivery = await releaseProduct({
        username: order.username,
        product_name: order.product_name,
        duration: order.duration,
      });
    } catch (releaseError: unknown) {
      const message =
        releaseError instanceof Error ? releaseError.message : "Unknown key delivery error";

      console.error("KEY RELEASE EXCEPTION:", { gatewayOrderId, message });

      await markDeliveryFailed(gatewayOrderId);

      return NextResponse.json(
        {
          success: false,
          status: "delivery_failed",
          error: "Payment could not be completed with key delivery. Contact support before retrying.",
        },
        { status: 409 }
      );
    }

    if (!delivery.success || typeof delivery.key !== "string" || !delivery.key.trim()) {
      const deliveryError = "error" in delivery ? delivery.error : undefined;

      console.error("KEY RELEASE FAILED:", {
        gatewayOrderId,
        error: deliveryError || "No valid key returned",
      });

      await markDeliveryFailed(gatewayOrderId);

      return NextResponse.json(
        {
          success: false,
          status: "delivery_failed",
          error: "Payment could not be completed with key delivery. Contact support before retrying.",
        },
        { status: 409 }
      );
    }

    const generatedKey = delivery.key.trim();

    // 9. Record the exact generated key before finalizing the order.
    const purchasedAt = new Date().toISOString();

    const { error: historyError } = await supabase.from("purchase_history").insert([
      {
        username: order.username,
        product_name: order.product_name,
        duration: order.duration,
        key_code: generatedKey,
        price_paid: String(order.amount),
        purchased_at: purchasedAt,
        created_at: purchasedAt,
      },
    ]);

    if (historyError) {
      // Keep the order in "processing" to block automatic re-purchasing.
      // Still return the key to this verified payment request.
      console.error("PURCHASE HISTORY INSERT FAILED:", {
        gatewayOrderId,
        error: historyError,
      });
    } else {
      // 10. Finalize the order only after the key has been recorded.
      const { data: finalizedOrder, error: finalizeError } = await supabase
        .from("payment_orders")
        .update({ status: "success", used: true })
        .eq("gateway_order_id", gatewayOrderId)
        .eq("status", "processing")
        .select("gateway_order_id")
        .maybeSingle();

      if (finalizeError || !finalizedOrder) {
        // Do not call releaseProduct again: the key has already been generated.
        console.error("ORDER FINALIZATION NEEDS REVIEW:", {
          gatewayOrderId,
          error: finalizeError,
        });
      }
    }

    // 11. Send Telegram notification. Notification failure must not lose the key.
    try {
      await sendTelegramPurchase({
        username: order.username,
        product: order.product_name,
        duration: order.duration,
        amount: Number(order.amount),
        method: "UPI",
        key: generatedKey,
      });
    } catch (telegramError) {
      console.error("TELEGRAM NOTIFICATION ERROR:", telegramError);
    }

    // 12. Return the generated key to the customer.
    return NextResponse.json({
      success: true,
      status: "success",
      key: generatedKey,
      order_id: gatewayOrderId,
      utr: payment.utr || null,
      sender_name: payment.payer || null,
      payment_time: payment.paymentTime || null,
    });
  } catch (error: unknown) {
    console.error("VERIFY PAYMENT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected payment verification error occurred. Contact support if payment was deducted.",
      },
      { status: 500 }
    );
  }
}
