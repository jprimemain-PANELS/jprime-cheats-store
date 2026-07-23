import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { releaseProduct } from "@/lib/release-product";

export async function POST(request: NextRequest) {
  try {
    const {
      username,
      product_name,
      duration,
      amount,
    } = await request.json();

    if (!username || !product_name || !duration || amount === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields.",
        },
        {
          status: 400,
        }
      );
    }

    const price = Number(amount);

    // Load wallet
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (walletError || !wallet) {
      return NextResponse.json(
        {
          success: false,
          error: "Wallet not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (Number(wallet.balance) < price) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient wallet balance.",
        },
        {
          status: 400,
        }
      );
    }

    const newBalance = Number(wallet.balance) - price;

    // Deduct wallet
    const { error: updateError } = await supabase
      .from("wallets")
      .update({
        balance: newBalance,
      })
      .eq("id", wallet.id);

    if (updateError) {
      return NextResponse.json(
        {
          success: false,
          error: "Unable to deduct wallet balance.",
        },
        {
          status: 500,
        }
      );
    }

    // Save wallet transaction
    await supabase.from("wallet_transactions").insert({
      username,
      type: "purchase",
      amount: price,
      balance_after: newBalance,
      description: `${product_name} (${duration})`,
    });

    // Deliver product
    const delivery = await releaseProduct({
      username,
      product_name,
      duration,
    });

    if (!delivery.success) {
      // Refund automatically
      await supabase
        .from("wallets")
        .update({
          balance: wallet.balance,
        })
        .eq("id", wallet.id);

      return NextResponse.json(
        {
          success: false,
          error: delivery.error,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      key: delivery.key,
      newBalance,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      {
        status: 500,
      }
    );
  }
}