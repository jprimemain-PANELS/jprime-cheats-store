import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { releaseProduct } from "@/lib/release-product";

async function sendTelegramNotification(details: {
  username: string;
  productName: string;
  duration: string;
  price: number;
  key: string;
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) return;

  const message = `🛒 *New Purchase via Wallet!*\n\n` +
    `👤 *User:* ${details.username}\n` +
    `📦 *Product:* ${details.productName}\n` +
    `⏱️ *Duration:* ${details.duration}\n` +
    `💰 *Price:* ₹${details.price}\n` +
    `🔑 *Key:* \`${details.key}\``;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });
  } catch (err) {
    console.error("Telegram notification error:", err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const username = body.username || body.user || body.userName;
    const productName = body.productName || body.product_name || body.name;
    const duration = body.duration;
    const price = body.price !== undefined ? body.price : body.amount;

    if (!username || !productName || !duration || price === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    // 1. Fetch user wallet balance
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("balance")
      .eq("username", username)
      .maybeSingle();

    if (walletError || !wallet) {
      return NextResponse.json(
        { success: false, error: `Wallet not found for user "${username}".` },
        { status: 400 }
      );
    }

    const currentBalance = Number(wallet.balance);
    const itemPrice = Number(price);

    if (currentBalance < itemPrice) {
      return NextResponse.json(
        { success: false, error: "Insufficient wallet balance." },
        { status: 400 }
      );
    }

    // 2. Fulfill key release
    const releaseResult = await releaseProduct({
      username,
      product_name: productName,
      duration,
    });

    if (!releaseResult || !releaseResult.key) {
      return NextResponse.json(
        {
          success: false,
          error: releaseResult?.message || "Failed to generate product key.",
        },
        { status: 500 }
      );
    }

    // 3. Deduct wallet balance
    const newBalance = currentBalance - itemPrice;
    await supabase
      .from("wallets")
      .update({ balance: newBalance })
      .eq("username", username);

    // 4. Record purchase directly into purchase_history using exact table columns
    const { error: historyErr } = await supabase
      .from("purchase_history")
      .insert([
        {
          username: username,
          product_name: productName,
          duration: duration,
          key_code: releaseResult.key,
          created_at: new Date().toISOString(),
        },
      ]);

    if (historyErr) {
      console.error("Failed to insert into purchase_history:", historyErr);
    }

    // 5. Send Telegram Notification
    await sendTelegramNotification({
      username,
      productName,
      duration,
      price: itemPrice,
      key: releaseResult.key,
    });

    return NextResponse.json({
      success: true,
      key: releaseResult.key,
      newBalance,
      type: releaseResult.type,
    });
  } catch (error: any) {
    console.error("Wallet payment route error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Wallet payment failed." },
      { status: 500 }
    );
  }
}