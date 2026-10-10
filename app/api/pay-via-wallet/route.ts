import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, rateLimit } from "@/lib/auth";
import { getTrustedQuote } from "@/lib/pricing";
import { releaseProduct } from "@/lib/release-product";
import { sendTelegramPurchase } from "@/lib/telegram";
import {
  acquire,
  creditWallet,
  debitWallet,
  logWalletTransaction,
  release,
} from "@/lib/wallet";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ success: false, error, ...extra }, { status, headers: NO_STORE });
}

/**
 * Wallet purchase.
 * - Buyer = authenticated session user (username in the body is ignored).
 * - Price = computed on the server (any amount in the body is ignored).
 * - Wallet is debited with a compare-and-swap BEFORE the supplier is called,
 *   so concurrent requests cannot spend the same balance twice.
 * - If delivery fails, the exact amount is refunded and logged.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const { username, role } = auth.user;

  if (!rateLimit(`wallet-buy:${username}`, 12, 60_000)) {
    return fail("Too many requests. Please wait a moment.", 429);
  }

  const lockKey = `wallet-buy:${username}`;
  if (!acquire(lockKey)) {
    return fail("Another purchase is already in progress.", 409);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const productName = String(body?.product_name ?? body?.productName ?? "").trim();
    const duration = String(body?.duration ?? "").trim();

    if (!productName || !duration) return fail("Missing required fields.", 400);

    // 1. Trusted price + status.
    const quote = await getTrustedQuote({ username, role, productName, duration });
    if (!quote.ok) return fail(quote.error, quote.httpStatus);
    if (quote.status === "MAINTENANCE") {
      return fail("This product is under maintenance. Please check back soon.", 409);
    }

    // 2. Atomic debit.
    const debit = await debitWallet(username, quote.price);
    if (!debit.ok) {
      if (debit.reason === "insufficient") return fail("Insufficient wallet balance.", 400);
      return fail("Could not process wallet payment.", 500);
    }

    // Written immediately so a crash after this point is recoverable from the ledger.
    await logWalletTransaction({
      username,
      type: "purchase",
      amount: quote.price,
      balance_after: debit.balance,
      description: `Purchase: ${productName} (${duration})`,
    });

    // 3. Deliver the key.
    let key: string | null = null;
    try {
      const delivery: any = await releaseProduct({ username, product_name: productName, duration });
      if (delivery?.success && typeof delivery.key === "string" && delivery.key.trim()) {
        key = delivery.key.trim();
      } else {
        console.error("WALLET DELIVERY FAILED:", { username, productName, duration });
      }
    } catch (e) {
      console.error("WALLET DELIVERY EXCEPTION:", e instanceof Error ? e.message : "unknown");
    }

    // 4. Failure -> refund exactly once.
    if (!key) {
      const refund = await creditWallet(username, quote.price);
      if (refund.ok) {
        await logWalletTransaction({
          username,
          type: "refund",
          amount: quote.price,
          balance_after: refund.balance,
          description: `Refund (delivery failed): ${productName} (${duration})`,
        });
        return fail("Could not deliver the key right now. You were not charged.", 502, {
          newBalance: refund.balance,
        });
      }
      console.error("WALLET REFUND FAILED - MANUAL REVIEW:", { username, amount: quote.price, productName, duration });
      return fail("Delivery failed and the refund needs support review. Contact support.", 500);
    }

    // 5. Purchase history (key is recorded so the user can always recover it).
    const { error: historyError } = await supabaseAdmin.from("purchase_history").insert([
      {
        username,
        product_name: productName,
        duration,
        key_code: key,
        created_at: new Date().toISOString(),
      },
    ]);
    if (historyError) {
      console.error("PURCHASE HISTORY INSERT FAILED:", historyError.message);
    }

    // 6. Telegram (never contains the key; failure never loses the key).
    try {
      await sendTelegramPurchase({
        username,
        product: productName,
        duration,
        amount: quote.price,
        method: "Wallet",
      });
    } catch (e) {
      console.error("TELEGRAM NOTIFICATION ERROR");
    }

    return NextResponse.json(
      { success: true, key, newBalance: debit.balance },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error("WALLET PAYMENT ERROR:", error instanceof Error ? error.message : "unknown");
    return fail("Wallet payment failed.", 500);
  } finally {
    release(lockKey);
  }
}
