import { NextResponse } from "next/server";

const API_URL = "https://xyzcheats.com/api/reseller_v1.php";

const DURATION_MAP: Record<string, string> = {
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

const ALLOWED_PRODUCT = {
  id: "haxxcker-client",
  pid: "133",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      productId,
      duration,
    } = body;

    // --------------------------------------------------
    // 1. Basic validation
    // --------------------------------------------------

    if (!productId) {
      return NextResponse.json(
        {
          success: false,
          message: "Product ID is required.",
        },
        { status: 400 }
      );
    }

    if (productId !== ALLOWED_PRODUCT.id) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid product.",
        },
        { status: 400 }
      );
    }

    if (!duration) {
      return NextResponse.json(
        {
          success: false,
          message: "Duration is required.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 2. Convert website duration to API duration
    // --------------------------------------------------

    const apiDuration = DURATION_MAP[duration];

    if (!apiDuration) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid duration.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 3. Android ID is mandatory for PID 133 / V1
    // --------------------------------------------------

    if (!androidId || !androidId.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Android ID is required for this product.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 4. Read secrets from server environment
    // --------------------------------------------------

    const apiKey = process.env.XYZCHEATS_API_KEY;
    const masterKey = process.env.XYZCHEATS_MASTER_KEY;

    if (!apiKey || !masterKey) {
      console.error("XYZCheats API credentials are missing.");

      return NextResponse.json(
        {
          success: false,
          message: "Server API configuration is missing.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 5. Prepare provider request
    // --------------------------------------------------

    const data = new URLSearchParams();

    data.append("api_key", apiKey);
    data.append("action", "buy");
    data.append("product_id", ALLOWED_PRODUCT.pid);
    data.append("duration", apiDuration);
    data.append("android_id", androidId.trim());

    // --------------------------------------------------
    // 6. Call XYZ reseller API
    // --------------------------------------------------

    const response = await fetch(API_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-master-key": masterKey,
      },

      body: data.toString(),

      cache: "no-store",
    });

    const responseText = await response.text();

    // --------------------------------------------------
    // 7. Try to parse provider response as JSON
    // --------------------------------------------------

    let providerResponse: unknown;

    try {
      providerResponse = JSON.parse(responseText);
    } catch {
      providerResponse = {
        raw: responseText,
      };
    }

    if (!response.ok) {
      console.error("XYZ API HTTP error:", response.status, providerResponse);

      return NextResponse.json(
        {
          success: false,
          message: "Product provider rejected the request.",
          provider: providerResponse,
        },
        { status: 502 }
      );
    }

    // --------------------------------------------------
    // 8. Return provider result to frontend
    // --------------------------------------------------

    return NextResponse.json({
      success: true,
      productId,
      duration,
      androidId,
      provider: providerResponse,
    });
  } catch (error) {
    console.error("Reseller purchase error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to process the product request.",
      },
      { status: 500 }
    );
  }
}