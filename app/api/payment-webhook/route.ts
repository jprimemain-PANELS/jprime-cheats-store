import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * MacroDroid payment receiver.
 * Now requires a shared secret (env: PAYMENT_WEBHOOK_SECRET) sent in the
 * "x-webhook-secret" header. If the env var is not set the webhook is DISABLED
 * (fails closed) - previously anyone on the internet could call it.
 */
function authorised(request: Request): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || secret.length < 16) return false;

  const provided = request.headers.get("x-webhook-secret") || "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET() {
  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  try {
    if (!authorised(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawText = await request.text();

    if (!rawText || rawText.trim() === "" || rawText.length > 2000) {
      return NextResponse.json({ error: "Notification text is empty." }, { status: 400 });
    }

    const amountMatch = rawText.match(/₹\s*(\d+\.\d{2})/);

    if (!amountMatch) {
      return NextResponse.json({ error: "Could not extract price amount from notification text." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc("process_payment_and_release_key", {
      payment_amount: amountMatch[1],
    });

    if (error) {
      console.error("WEBHOOK RPC ERROR:", error.message);
      return NextResponse.json({ error: "Processing failed." }, { status: 500 });
    }

    const result = Array.isArray(data) ? data[0] : null;

    if (!result || !result.success) {
      return NextResponse.json({ error: "No matching payment." }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Payment verified and key linked successfully!" });
  } catch (err) {
    console.error("WEBHOOK ERROR:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
