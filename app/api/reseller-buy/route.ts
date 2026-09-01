import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { product_id, duration } = await request.json();

    if (!product_id || !duration) {
      return NextResponse.json(
        { status: "error", message: "Missing product_id or duration" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({
      api_key: process.env.RESELLER_API_KEY || "",
      action: "buy",
      product_id: String(product_id),
      duration: duration,
    });

    const response = await fetch("https://adminpanels.shop/api/reseller_v1.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-master-key": process.env.RESELLER_MASTER_KEY || "a7f3e8b2c9d1f4a6b8c2d5e9f1a3b6c8",
      },
      body: params.toString(),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to contact supplier API" },
      { status: 500 }
    );
  }
}