import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json(
        {
          success: false,
          error: "Username required",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("wallets")
      .select("balance")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    // Automatically create wallet if it doesn't exist
    if (!data) {
      const { error: insertError } = await supabase
        .from("wallets")
        .insert({
          username,
          balance: 0,
        });

      if (insertError) {
        return NextResponse.json(
          {
            success: false,
            error: insertError.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        balance: 0,
      });
    }

    return NextResponse.json({
      success: true,
      balance: Number(data.balance),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}