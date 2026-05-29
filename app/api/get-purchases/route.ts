import { NextResponse }
from "next/server";

import { createClient }
from "@supabase/supabase-js";

const supabase =
  createClient(
    process.env
      .NEXT_PUBLIC_SUPABASE_URL || "",

    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );

export async function GET() {

  try {

    const { data, error } =
      await supabase
        .from(
          "purchase_history"
        )
        .select("*")
        .order(
          "created_at",
          {
            ascending: false,
          }
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
      purchases: data,
    });

  } catch (error) {

    return NextResponse.json({
      success: false,
      error,
    });
  }
}