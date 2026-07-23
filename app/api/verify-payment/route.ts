import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { releaseProduct } from "@/lib/release-product";

const FP_VERIFY_URL = "https://xyzcheats.com/gateway/verify.php";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("VERIFY BODY:", body);

    const gatewayOrderId = body.gateway_order_id;
    
    // Sanitize UTR server-side: strip everything except digits to match input filtering
    const rawUtr = body.utr;
    const utr = rawUtr ? String(rawUtr).replace(/\D/g, "") : "";
    
    // Log the state of the UTR right before validation and fetch processing
    console.log("UTR STATE:", utr);

    if (!gatewayOrderId || !utr) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing gateway order ID or UTR",
        },
        {
          status: 400,
        }
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
        {
          status: 500,
        }
      );
    }

    // Find the exact internal order.
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
        {
          status: 500,
        }
      );
    }

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment order not found",
        },
        {
          status: 404,
        }
      );
    }

    // If already completed, return the previously delivered key instead of taking another stock key.
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

    // Ask FP gateway for actual payment status.
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
    console.log("RAW XYZCHEATS RESPONSE:", responseText);
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
        {
          status: 502,
        }
      );
    }

    // Payment is still pending.
    if (gatewayData?.status === "pending") {
      return NextResponse.json({
        success: true,
        status: "pending",
      });
    }

    // Anything except confirmed success must not release a key.
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
        {
          status: 502,
        }
      );
    }

    const payment = gatewayData.data;

    // Verify the gateway's paid amount matches our own stored order.
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
        {
          status: 409,
        }
      );
    }

    // Find one unused key.
const delivery = await releaseProduct({
  username: order.username,
  product_name: order.product_name,
  duration: order.duration,
});

if (!delivery.success) {
  return NextResponse.json(
    {
      success: false,
      status: "out_of_stock",
      error: delivery.error,
    },
    {
      status: 409,
    }
  );
}

// Complete payment order
const { error: orderUpdateError } = await supabase
  .from("payment_orders")
  .update({
    status: "success",
    used: true,
  })
  .eq("gateway_order_id", gatewayOrderId);

if (orderUpdateError) {
  return NextResponse.json(
    {
      success: false,
      error: "Payment verified but failed to update order.",
    },
    {
      status: 500,
    }
  );
}

return NextResponse.json({
  success: true,
  status: "success",
  key: delivery.key,
  order_id: gatewayOrderId,
  utr: payment.utr || null,
  sender_name: payment.sender_name || null,
  payment_time: payment.payment_time || null,
});

    // Mark the selected key as used.
    const { error: keyUpdateError } = await supabase
      .from("stock_keys")
      .update({ is_used: true })
      .eq("id", stockKey.id)
      .eq("is_used", false);

    if (keyUpdateError) {
      console.error("KEY UPDATE ERROR:", keyUpdateError);

      return NextResponse.json(
        {
          success: false,
          error: "Could not reserve product key",
        },
        {
          status: 500,
        }
      );
    }

    // Save purchase history.
    const { error: historyError } = await supabase
      .from("purchase_history")
      .insert([
        {
          username: order.username,
          product_name: order.product_name,
          duration: order.duration,
          key_code: stockKey.key_code,
        },
      ]);

    if (historyError) {
      console.error("PURCHASE HISTORY ERROR:", historyError);

      // Roll back key usage if saving purchase history fails.
      await supabase
        .from("stock_keys")
        .update({ is_used: false })
        .eq("id", stockKey.id);

      return NextResponse.json(
        {
          success: false,
          error: "Could not save purchase",
        },
        {
          status: 500,
        }
      );
    }

    // Complete payment order.
    const { error: orderUpdateError } = await supabase
      .from("payment_orders")
      .update({
        status: "success",
        used: true,
      })
      .eq("gateway_order_id", gatewayOrderId);

    if (orderUpdateError) {
      console.error("ORDER UPDATE ERROR:", orderUpdateError);

      return NextResponse.json(
        {
          success: false,
          error: "Payment was verified, but order completion failed",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      status: "success",
      key: stockKey.key_code,
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
      {
        status: 500,
      }
    );
  }
}