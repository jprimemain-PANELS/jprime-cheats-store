export async function sendTelegramPurchase({
  username,
  product,
  duration,
  amount,
}: {
  username: string;
  product: string;
  duration: string;
  amount: number;
}) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) return;

  const time = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const message = `🛒 <b>New Purchase</b>

👤 User : <b>${username}</b>
📦 Product : <b>${product}</b>
⏳ Duration : <b>${duration}</b>
💰 Paid : <b>₹${amount}</b>
🕒 Time : <b>${time}</b>

✅ <b>Key Released</b>`;

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    }
  );

  const result = await response.json();

  console.log("Telegram Response:", result);
}