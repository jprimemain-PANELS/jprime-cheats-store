import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { variant_id } = await request.json();

    if (!variant_id) {
      return NextResponse.json(
        {
          status: "error",
          message: "Missing variant_id",
        },
        { status: 400 }
      );
    }

    const apiToken = process.env.SELLER2_API_TOKEN;

    if (!apiToken) {
      return NextResponse.json(
        {
          status: "error",
          message: "Seller 2 API token is not configured",
        },
        { status: 500 }
      );
    }

    const response = await fetch(
      "https://whitexmodz.store/api/v1/generate_key.php",
      {
        method: "POST",
        headers: {
          "X-API-Token": apiToken,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          variant_id: String(variant_id),
          quantity: "1",
        }).toString(),
      }
    );

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error?.message || "Failed to contact Seller 2 API",
      },
      { status: 500 }
    );
  }
}