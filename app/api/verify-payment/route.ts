import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { releaseProduct } from "@/lib/release-product";
import { sendTelegramPurchase } from "@/lib/telegram";

const FP_VERIFY_URL = "https://xyzcheats.com/gateway/verify.php";
const XYZ_API_URL = "https://xyzcheats.com/api/reseller_v1.php";

const HAXXCKER_PRODUCT_ID = "133";

const HAXXCKER_DURATION_MAP: Record<string, string> = {
  "1 hour": "1 Hours",
  "3 hour": "3 Hours",
  "6 hour": "6 Hours",
  "12 hour": "12 Hours",
  "1 day": "1 Days",
  "2 day": "2 Days",
  "3 day": "3 Days",
  "5 day": "5 Days",
  "7 day": "7 Days",
};

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

// --------------------------------------------------
// HAXXCKER CLIENT
// Payment verified → generate access from XYZCheats
// --------------------------------------------------

let generatedKey: string | null = null;

if (order.product_name === "HAXXCKER CLIENT") {
  const xyzApiKey = process.env.XYZCHEATS_API_KEY;
  const xyzMasterKey = process.env.XYZCHEATS_MASTER_KEY;

  if (!xyzApiKey || !xyzMasterKey) {
    console.error("XYZCheats API credentials are missing.");

    return NextResponse.json(
      {
        success: false,
        error: "HAXXCKER provider is not configured.",
      },
      { status: 500 }
    );
  }

  const androidId = order.android_id
    ? String(order.android_id).trim()
    : "";

  if (!androidId) {
    return NextResponse.json(
      {
        success: false,
        error: "Android ID is missing from payment order.",
      },
      { status: 400 }
    );
  }

  const xyzDuration =
    HAXXCKER_DURATION_MAP[String(order.duration).toLowerCase()];

  if (!xyzDuration) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid HAXXCKER duration.",
      },
      { status: 400 }
    );
  }

  const xyzData = new URLSearchParams();

  xyzData.append("api_key", xyzApiKey);
  xyzData.append("action", "buy");
  xyzData.append("product_id", HAXXCKER_PRODUCT_ID);
  xyzData.append("duration", xyzDuration);
  xyzData.append("android_id", androidId);

  const xyzResponse = await fetch(XYZ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-master-key": xyzMasterKey,
    },
    body: xyzData.toString(),
    cache: "no-store",
  });

  const xyzResponseText = await xyzResponse.text();

  console.log("=================================");
  console.log("HAXXCKER XYZ RESPONSE:");
  console.log(xyzResponseText);
  console.log("=================================");

  let xyzDataResponse: any;

  try {
    xyzDataResponse = JSON.parse(xyzResponseText);
  } catch {
    console.error(
      "Invalid HAXXCKER provider response:",
      xyzResponseText
    );

    return NextResponse.json(
      {
        success: false,
        error: "HAXXCKER provider returned invalid data.",
      },
      { status: 502 }
    );
  }

  if (!xyzResponse.ok) {
    console.error(
      "HAXXCKER provider HTTP error:",
      xyzDataResponse
    );

    return NextResponse.json(
      {
        success: false,
        error:
          xyzDataResponse?.message ||
          "HAXXCKER provider rejected the request.",
      },
      { status: 502 }
    );
  }

  // We need the generated access from the provider.
  generatedKey =
    xyzDataResponse?.data?.key ||
    xyzDataResponse?.data?.access_key ||
    xyzDataResponse?.key ||
    xyzDataResponse?.access_key ||
    null;

  if (!generatedKey) {
    console.error(
      "HAXXCKER provider did not return an access key:",
      xyzDataResponse
    );

    return NextResponse.json(
      {
        success: false,
        error:
          xyzDataResponse?.message ||
          "HAXXCKER access was not generated.",
      },
      { status: 502 }
    );
  }
}

// --------------------------------------------------
// EXISTING PRODUCTS
// Keep the existing stock-key system unchanged.
// --------------------------------------------------

if (order.product_name !== "HAXXCKER CLIENT") {
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

  generatedKey = delivery.key;
}

const { error: paymentOrderUpdateError } = await supabase
  .from("payment_orders")
  .update({
    status: "success",
    used: true,
  })
  .eq("gateway_order_id", gatewayOrderId);

if (paymentOrderUpdateError) {
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

await sendTelegramPurchase({
  username: order.username,
  product: order.product_name,
  duration: order.duration,
  amount: Number(order.amount),
});

// 5. Return success
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
      {
        status: 500,
      }
    );
  }
}