import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      username,
      product_name,
      duration,
      amount,
    } = body;

    const { count } =
    await supabase
      .from("payment_orders")
      .select("*", {
        count: "exact",
        head: true,
      });
  
  const uniquePaise =
    ((count || 0) % 99) + 1;
  
  const finalAmount =
  (
    Number(amount) +
    uniquePaise / 100
  ).toFixed(2);

    const { data, error } =
      await supabase
        .from("payment_orders")
        .insert([
          {
            username,
            product_name,
            duration,
            amount: finalAmount,
            status: "pending",
          },
        ])
        .select()
        .single();

    console.log("INSERT DATA:", data);
    console.log("INSERT ERROR:", error);

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
      });
    }

    return NextResponse.json({
      success: true,
      order: data,
      amount: finalAmount,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error,
    });
  }
}