import {
    NextRequest,
    NextResponse,
  } from "next/server";
  
  import {
    supabase,
  } from "@/lib/supabase";
  
  const FP_CREATE_ORDER_URL =
    "https://xyzcheats.com/gateway/create_order.php";
  
  export async function POST(
    request: NextRequest
  ) {
    try {
      const body = await request.json();
  
const {
  username,
  amount,
  mobile_number,
} = body;
  
      // Validate required information
if (
  !username ||
  !amount ||
  !mobile_number
){
        return NextResponse.json(
          {
            success: false,
            error:
              "Missing required order information",
          },
          {
            status: 400,
          }
        );
      }
  
      const numericAmount =
        Number(amount);
  
      if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid payment amount",
          },
          {
            status: 400,
          }
        );
      }
  
      // Secret key exists only on server
      const apiKey =
        process.env.FP_API_KEY;
  
      if (!apiKey) {
        console.error(
          "FP_API_KEY is missing"
        );
  
        return NextResponse.json(
          {
            success: false,
            error:
              "Payment gateway is not configured",
          },
          {
            status: 500,
          }
        );
      }
  
      // Create order with FP payment gateway
      const gatewayUrl =
        new URL(FP_CREATE_ORDER_URL);
  
      gatewayUrl.searchParams.set(
        "amount",
        String(numericAmount)
      );
  
      gatewayUrl.searchParams.set(
        "api_key",
        apiKey
      );
  
      const gatewayResponse =
        await fetch(
          gatewayUrl.toString(),
          {
            method: "GET",
            cache: "no-store",
          }
        );
  
      const responseText =
        await gatewayResponse.text();
  
      let gatewayData: any;
  
      try {
        gatewayData =
          JSON.parse(responseText);
      } catch {
        console.error(
          "Invalid gateway response:",
          responseText
        );
  
        return NextResponse.json(
          {
            success: false,
            error:
              "Payment gateway returned an invalid response",
          },
          {
            status: 502,
          }
        );
      }
  
      if (
        !gatewayResponse.ok ||
        gatewayData?.status !==
          "success" ||
        !gatewayData?.data?.order_id ||
        !gatewayData?.data?.qr_url
      ) {
        console.error(
          "Gateway order creation failed:",
          gatewayData
        );
  
        return NextResponse.json(
          {
            success: false,
            error:
              gatewayData?.message ||
              "Failed to create payment order",
          },
          {
            status: 502,
          }
        );
      }
  
      const gatewayOrder =
        gatewayData.data;
  
      // Save the gateway order in Supabase
      const {
        data: savedOrder,
        error: insertError,
      } = await supabase
        .from("deposit_history")
        .insert([
{
  username: String(username),

  amount: String(gatewayOrder.amount),

  gateway_order_id: String(gatewayOrder.order_id),

  mobile_number: String(mobile_number),

  status: "pending",
},
        ])
        .select()
        .single();
  
      if (insertError) {
        console.error(
          "PAYMENT ORDER INSERT ERROR:",
          insertError
        );
  
        return NextResponse.json(
          {
            success: false,
            error:
              insertError.message,
          },
          {
            status: 500,
          }
        );
      }
  
      // Send safe order details to frontend
      // FP_API_KEY is never returned.
      return NextResponse.json({
        success: true,
  
        order: savedOrder,
  
        payment: {
          order_id:
            gatewayOrder.order_id,
  
          qr_url:
            gatewayOrder.qr_url,
  
          upi_link:
            gatewayOrder.upi_link,
  
          upi_id:
            gatewayOrder.upi_id,
  
          amount:
            gatewayOrder.amount,
  
          created_at:
            gatewayOrder.created_at,
  
          expires_at:
            gatewayOrder.expires_at,
        },
      });
    } catch (error) {
      console.error(
        "CREATE UPI ORDER ERROR:",
        error
      );
  
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Unknown server error",
        },
        {
          status: 500,
        }
      );
    }
  }