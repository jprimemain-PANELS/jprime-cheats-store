import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

const supabase =
  createClient(
    process.env
      .NEXT_PUBLIC_SUPABASE_URL || "",

    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );

export async function POST(
  request: NextRequest
) {

  try {

    const body =
      await request.json();

    console.log(
      "BODY:",
      body
    );

    const {
      username,
      product_name,
      duration,
      key_code,
    } = body;

    const { data, error } =
      await supabase
        .from(
          "purchase_history"
        )
        .insert([
          {
            username,
            product_name,
            duration,
            key_code,
          },
        ])
        .select();

    console.log(
      "INSERT DATA:",
      data
    );

    console.log(
      "INSERT ERROR:",
      error
    );

    if (error) {

      return NextResponse.json({
        success: false,
        error:
          error.message,
      });
    }

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error) {

    console.log(
      "SERVER ERROR:",
      error
    );

    return NextResponse.json({
      success: false,
      error,
    });
  }
}