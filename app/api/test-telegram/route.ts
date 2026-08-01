import { NextResponse } from "next/server";

export async function GET() {
  const response = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: "✅ Telegram Test from JPrimeCheats",
      }),
    }
  );

  const data = await response.json();

  return NextResponse.json(data);
}