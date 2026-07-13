import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabase,
} from "@/lib/supabase";

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const orderId =
      body.order_id;

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing order ID",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: order,
      error,
    } = await supabase
      .from("payment_orders")
      .select(`
        gateway_order_id,
        amount,
        status,
        used,
        qr_url,
        upi_link,
        expires_at
      `)
      .eq(
        "gateway_order_id",
        orderId
      )
      .maybeSingle();

    if (error) {
      console.error(
        "GET PAYMENT ORDER ERROR:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Could not load payment order",
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
          error:
            "Payment order not found",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,

      order: {
        order_id:
          order.gateway_order_id,

        amount:
          order.amount,

        status:
          order.status,

        used:
          order.used,

        qr_url:
          order.qr_url,

        upi_link:
          order.upi_link,

        expires_at:
          order.expires_at,
      },
    });
  } catch (error) {
    console.error(
      "GET PAYMENT ORDER SERVER ERROR:",
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