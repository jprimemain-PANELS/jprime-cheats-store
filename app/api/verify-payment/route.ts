import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { releaseProduct } from "@/lib/release-product";
import { sendTelegramPurchase } from "@/lib/telegram";

const FP_VERIFY_URL = "https://xyzcheats.com/gateway/verify.php";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("VERIFY BODY:", body);

    const gatewayOrderId = body.gateway_order_id;

    // Sanitize UTR server-side: strip everything except digits to match input filtering
    const rawUtr = body.utr;
    const utr = rawUtr ? String(rawUtr).replace(/\D/g, "") : "";

    console.log("UTR STATE:", utr);

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

    // 1. Find the internal payment order
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

    // 2. If already completed, return the previously delivered key from purchase_history
    if (order.status === "success") {
      const { data: existingPurchase } = await supabase
        .from("purchase_history")
        .select("key_code")
        .eq("username", order.username)
        .eq("product_name", order.product_name)
        .eq("duration", order.duration)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        status: "success",
        key: existingPurchase?.key_code || null,
      });
    }

    // 3. Ask FP gateway for actual payment status
    const verifyUrl = new URL(FP_VERIFY_URL);
    verifyUrl.searchParams.set("order_id", String(gatewayOrderId));
    verifyUrl.searchParams.set("api_key", apiKey);
    verifyUrl.searchParams.set("utr", utr);

    const gatewayResponse = await fetch(verifyUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const responseText = await gatewayResponse.text();

    console.log("=================================");
    console.log("GATEWAY ORDER ID:", gatewayOrderId);
    console.log("GATEWAY HTTP STATUS:", gatewayResponse.status);
    console.log("RAW GATEWAY RESPONSE:", responseText);
    console.log("=================================");

    let gatewayData: any;

    try {
      gatewayData = JSON.parse(responseText);
    } catch {
      console.error("INVALID VERIFY RESPONSE:", responseText);
      return NextResponse.json(
        {
          success: false,
          error: "Payment gateway returned invalid data",
        },
        { status: 502 }
      );
    }

    // Payment is still pending
    if (gatewayData?.status === "pending") {
      return NextResponse.json({
        success: true,
        status: "pending",
      });
    }

    // Anything except confirmed success must not release a key
    if (
      !gatewayResponse.ok ||
      gatewayData?.status !== "success" ||
      !gatewayData?.data
    ) {
      console.error("VERIFY PAYMENT FAILED:", gatewayData);

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

    // Verify paid amount matches order amount
    const expectedAmount = Number(order.amount);
    const paidAmount = Number(payment.amount);

    if (
      !Number.isFinite(expectedAmount) ||
      !Number.isFinite(paidAmount) ||
      Math.abs(expectedAmount - paidAmount) > 0.001
    ) {
      console.error("AMOUNT MISMATCH:", {
        expectedAmount,
        paidAmount,
        gatewayOrderId,
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

    // 4. Release Product Key
    let generatedKey: string | null = null;
    try {
      const delivery = await releaseProduct({
        username: order.username,
        product_name: order.product_name,
        duration: order.duration,
      });

      generatedKey = delivery.key;
    } catch (releaseErr: any) {
      console.error("KEY RELEASE ERROR:", releaseErr.message);
      return NextResponse.json(
        {
          success: false,
          status: "out_of_stock",
          error: releaseErr.message || "Failed to issue key.",
        },
        { status: 409 }
      );
    }

    // 5. Update payment_orders status
    const { error: paymentOrderUpdateError } = await supabase
      .from("payment_orders")
      .update({
        status: "success",
        used: true,
      })
      .eq("gateway_order_id", gatewayOrderId);

    if (paymentOrderUpdateError) {
      console.error("FAILED TO UPDATE ORDER STATUS:", paymentOrderUpdateError);
    }

    // 6. Record in purchase_history table
    const { error: historyErr } = await supabase
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

    if (historyErr) {
      console.error("Failed to insert into purchase_history:", historyErr);
    }

    // 7. Send Telegram Notification
    try {
      await sendTelegramPurchase({
        username: order.username,
        product: order.product_name,
        duration: order.duration,
        amount: Number(order.amount),
      });
    } catch (telegramErr) {
      console.error("Telegram notification error:", telegramErr);
    }

    // 8. Return success
    return NextResponse.json({
      success: true,
      status: "success",
      key: generatedKey,
      order_id: gatewayOrderId,
      utr: payment.utr || null,
      sender_name: payment.sender_name || null,
      payment_time: payment.payment_time || null,
    });
  } catch (error) {
    console.error("VERIFY PAYMENT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 }
    );
  }
}