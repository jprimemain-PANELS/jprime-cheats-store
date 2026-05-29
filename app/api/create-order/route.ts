import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest
) {

  try {

    const body =
      await request.json();

    const {
      product,
      duration,
      price,
    } = body;

    const response = await fetch(
      "https://sandbox.cashfree.com/pg/orders",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "x-client-id":
            process.env
              .NEXT_PUBLIC_CASHFREE_APP_ID || "",

          "x-client-secret":
            process.env
              .CASHFREE_SECRET_KEY || "",

          "x-api-version":
            "2023-08-01",
        },

        body: JSON.stringify({

          order_amount:
            Number(price),

          order_currency:
            "INR",

          customer_details: {
            customer_id:
              "test123",

            customer_name:
              "Jenith",

            customer_email:
              "test@example.com",

            customer_phone:
              "9999999999",
          },

          order_meta: {
            return_url:
              `http://localhost:3000/payment-success?product=${encodeURIComponent(product)}&duration=${encodeURIComponent(duration)}`,
          },
        }),
      }
    );

    const data =
      await response.json();

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error) {

    return NextResponse.json({
      success: false,
      error,
    });
  }
}