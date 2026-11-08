import { NextRequest, NextResponse } from "next/server";
import { rateLimit, requireUser } from "@/lib/auth";
import { getTrustedQuote } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * POST { code, product_name, duration } -> shows the customer the price WITH the coupon.
 * It is only a preview: the real price is always recomputed by the purchase routes.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const { username, role } = auth.user;

  if (!rateLimit(`coupon-check:${username}`, 20, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many attempts. Please wait a minute." }, { status: 429, headers: NO_STORE });
  }

  const body = await request.json().catch(() => ({}));
  const code = String(body?.code ?? "").trim().slice(0, 40);
  const productName = String(body?.product_name ?? "").trim();
  const duration = String(body?.duration ?? "").trim();

  if (!code || !productName || !duration) {
    return NextResponse.json({ success: false, error: "Enter a coupon code." }, { status: 400, headers: NO_STORE });
  }

  const quote = await getTrustedQuote({ username, role, productName, duration, coupon: code });

  if (!quote.ok) {
    return NextResponse.json({ success: true, valid: false, error: quote.error }, { headers: NO_STORE });
  }
  if (!quote.coupon) {
    return NextResponse.json({ success: true, valid: false, error: "Coupon not valid." }, { headers: NO_STORE });
  }

  return NextResponse.json(
    {
      success: true,
      valid: true,
      code: quote.coupon.code,
      percent: quote.coupon.percent,
      original: quote.coupon.originalPrice,
      final: quote.price,
    },
    { headers: NO_STORE }
  );
}
