import { NextRequest,
  NextResponse }
  from "next/server";
  
  import { supabase }
  from "@/lib/supabase";
  
  export async function POST(
    request: NextRequest
  ) {
  
    const body =
      await request.json();
  
    const {
      product_name,
      duration,
    } = body;
  
    const { data, error } =
      await supabase
        .from("stock_keys")
        .select("*")
        .eq(
          "product_name",
          product_name
        )
        .eq(
          "duration",
          duration
        )
        .eq(
          "is_used",
          false
        )
        .limit(1)
        .single();
  
    if (error || !data) {
  
      return NextResponse.json({
        success: false,
        message:
          "No keys available",
      });
    }
  
    await supabase
      .from("stock_keys")
      .update({
        is_used: true,
      })
      .eq(
        "id",
        data.id
      );
  
    return NextResponse.json({
      success: true,
  
      key:
        data.key_code,
  
      product_name:
        data.product_name,
  
      duration:
        data.duration,
    });
  }