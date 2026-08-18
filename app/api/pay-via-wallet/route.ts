import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { releaseProduct } from "@/lib/release-product";
import { sendTelegramPurchase } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  try {
    const {
      username,
      product_name,
      duration,
      amount,
      android_id,
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

    const isHaxxcker = product_name === "HAXXCKER CLIENT";

if (isHaxxcker && (!android_id || !String(android_id).trim())) {
  return NextResponse.json(
    {
      success: false,
      error: "Android ID is required for HAXXCKER CLIENT.",
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

// ✅ Send Telegram notification
await sendTelegramPurchase({
  username,
  product: product_name,
  duration,
  amount: price,
});

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