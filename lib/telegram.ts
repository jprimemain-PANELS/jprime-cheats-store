const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export async function sendTelegramPurchase({
  username,
  product,
  duration,
  amount,
  method,
}: {
  username: string;
  product: string;
  duration: string;
  amount: number;
  method?: string;
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
    timeZone: "Asia/Kolkata",
  });

  const message = `🛒 <b>New Purchase${method ? ` via ${esc(method)}` : ""}</b>

👤 User : <b>${esc(username)}</b>
📦 Product : <b>${esc(product)}</b>
⏳ Duration : <b>${esc(duration)}</b>
💰 Paid : <b>₹${esc(amount)}</b>
🕒 Time : <b>${esc(time)}</b>

✅ <b>Key Released</b>`;

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    }
  );

  if (!response.ok) {
    console.error("Telegram send failed, HTTP status:", response.status);
  }
}
