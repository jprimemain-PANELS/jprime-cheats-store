import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { requireUser, rateLimit } from "@/lib/auth";
import { releaseProduct } from "@/lib/release-product";
import { sendTelegramPurchase } from "@/lib/telegram";

const FP_VERIFY_URL = "https://xyzcheats.com/gateway/verify.php";

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

    const gatewayOrderId = String(
      body?.gateway_order_id ?? ""
    ).trim();

    const utr = String(body?.utr ?? "").replace(/\D/g, "");

    if (!gatewayOrderId || !utr) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing gateway order ID or UTR",
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.FP_API_KEY;

    if (!apiKey) {
      console.error("FP_API_KEY is missing");

      return NextResponse.json(
        {
          success: false,
          error: "Payment gateway is not configured",
        },
        { status: 500 }
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
        {
          success: false,
          error: "Could not load payment order",
        },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment order not found",
        },
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
        historyQuery = historyQuery.gte(
          "created_at",
          String(order.created_at)
        );
      }

      const {
        data: existingPurchase,
        error: historyLookupError,
      } = await historyQuery
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

    // Replay protection: a UTR that already settled any other order is rejected.
    // (Columns are checked defensively: works before and after the optional SQL migration.)
    for (const table of ["payment_orders", "deposit_history"] as const) {
      const { data: dup, error: dupError } = await supabase
        .from(table)
        .select("gateway_order_id")
        .eq("utr", utr)
        .neq("gateway_order_id", gatewayOrderId)
        .limit(1);

      if (!dupError && dup && dup.length > 0) {
        return NextResponse.json(
          {
            success: false,
            status: "duplicate_utr",
            error: "This UTR was already used for another payment.",
          },
          { status: 409 }
        );
      }
    }

    // 4. Verify the actual payment with the gateway.
    const verifyUrl = new URL(FP_VERIFY_URL);
    verifyUrl.searchParams.set("order_id", gatewayOrderId);
    verifyUrl.searchParams.set("api_key", apiKey);
    verifyUrl.searchParams.set("utr", utr);

    const gatewayResponse = await fetch(verifyUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const responseText = await gatewayResponse.text();

    let gatewayData: any;

    try {
      gatewayData = JSON.parse(responseText);
    } catch {
      // Avoid logging raw response data that might contain sensitive details.
      console.error("PAYMENT GATEWAY RETURNED INVALID JSON:", {
        gatewayOrderId,
        httpStatus: gatewayResponse.status,
      });

      return NextResponse.json(
        {
          success: false,
          error: "Payment gateway returned invalid data",
        },
        { status: 502 }
      );
    }

    if (gatewayData?.status === "pending") {
      return NextResponse.json({
        success: true,
        status: "pending",
      });
    }

    if (
      !gatewayResponse.ok ||
      gatewayData?.status !== "success" ||
      !gatewayData?.data
    ) {
      console.error("PAYMENT VERIFICATION FAILED:", {
        gatewayOrderId,
        httpStatus: gatewayResponse.status,
        gatewayStatus: gatewayData?.status,
      });

      return NextResponse.json(
        {
          success: false,
          status: "failed",
          error: gatewayData?.message || "Unable to verify payment",
        },
        { status: 502 }
      );
    }

    const payment = gatewayData.data;

    // 5. Confirm the paid amount matches the order.
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

    // 6. Atomically claim the order before calling either supplier.
    // Only one concurrent request can change the original status to processing.
    const originalStatus = String(order.status ?? "");

    if (!originalStatus) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment order has no valid status",
        },
        { status: 409 }
      );
    }

    let claim = await supabase
      .from("payment_orders")
      .update({ status: "processing", utr })
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

    // 7. Release the key from Seller 1, Seller 2, or local stock.
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
        releaseError instanceof Error
          ? releaseError.message
          : "Unknown key delivery error";

      console.error("KEY RELEASE EXCEPTION:", {
        gatewayOrderId,
        message,
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

    if (
      !delivery.success ||
      typeof delivery.key !== "string" ||
      !delivery.key.trim()
    ) {
      const deliveryError =
        "error" in delivery ? delivery.error : undefined;

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

    // 8. Record the exact generated key before finalizing the order.
    const { error: historyError } = await supabase
      .from("purchase_history")
      .insert([
        {
          username: order.username,
          product_name: order.product_name,
          duration: order.duration,
          key_code: generatedKey,
          created_at: new Date().toISOString(),
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
      // 9. Finalize the order only after the key has been recorded.
      const {
        data: finalizedOrder,
        error: finalizeError,
      } = await supabase
        .from("payment_orders")
        .update({
          status: "success",
          used: true,
        })
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

    // 10. Send Telegram notification. Notification failure must not lose the key.
    try {
      await sendTelegramPurchase({
        username: order.username,
        product: order.product_name,
        duration: order.duration,
        amount: Number(order.amount),
        method: "UPI",
      });
    } catch (telegramError) {
      console.error("TELEGRAM NOTIFICATION ERROR:", telegramError);
    }

    // 11. Return the generated key to the customer.
    return NextResponse.json({
      success: true,
      status: "success",
      key: generatedKey,
      order_id: gatewayOrderId,
      utr: payment.utr || null,
      sender_name: payment.sender_name || null,
      payment_time: payment.payment_time || null,
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