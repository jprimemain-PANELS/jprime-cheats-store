import { NextRequest, NextResponse } from "next/server";
import { tdb } from "@/lib/tenant-db";
import { requireUser, rateLimit } from "@/lib/auth";
import { getTrustedQuote } from "@/lib/pricing";
import { sendTelegramPurchase } from "@/lib/telegram";
import { acquire, creditWallet, debitWallet, logWalletTransaction, release } from "@/lib/wallet";
import { creditsOfPlan, makeTokenCode, tokenKey } from "@/lib/guild-glory";
import { NO_STORE, fail, guildGate, isGuildProduct } from "../_shared";

export const dynamic = "force-dynamic";

/** Buy Guild tokens (1, 2, 5 ... credits) with the wallet. Price is computed on the server; the token code is returned once and saved in purchase history. */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { username, role } = auth.user;
  const tenantId = auth.tenant.id;
  const blocked = guildGate(auth.tenant, tenantId);
  if (blocked) return blocked;
  if (!rateLimit(`guild-buy:${tenantId}:${username}`, 8, 60_000)) return fail("Too many requests. Please wait a moment.", 429);
  const lockKey = `guild-buy:${tenantId}:${username}`;
  if (!acquire(lockKey)) return fail("Another order is already in progress.", 409);
  try {
    const b = await request.json().catch(() => ({}));
    const productName = String(b?.product_name ?? "").trim();
    const duration = String(b?.duration ?? "").trim();
    const credits = creditsOfPlan(duration);
    if (!productName || !credits) return fail("Choose how many tokens to buy.", 400);
    if (!(await isGuildProduct(tenantId, productName))) return fail("This service is not available.", 404);

    const quote = await getTrustedQuote({ tenantId, username, role, productName, duration });
    if (!quote.ok) return fail(quote.error, quote.httpStatus);
    if (quote.status === "MAINTENANCE") return fail("This service is under maintenance. Please check back soon.", 409);

    const debit = await debitWallet(tenantId, username, quote.price);
    if (!debit.ok) return fail(debit.reason === "insufficient" ? "Insufficient wallet balance." : "Could not process wallet payment.", debit.reason === "insufficient" ? 400 : 500);
    await logWalletTransaction({ tenantId, username, type: "purchase", amount: quote.price, balance_after: debit.balance, description: `Guild token x${credits} (${duration})` });

    const code = makeTokenCode();
    const made = await creditWallet(tenantId, tokenKey(code), credits);
    if (!made.ok) {
      const refund = await creditWallet(tenantId, username, quote.price);
      if (refund.ok) {
        await logWalletTransaction({ tenantId, username, type: "refund", amount: quote.price, balance_after: refund.balance, description: "Refund (Guild token failed)" });
        return fail("Could not create the token. You were not charged.", 502, { newBalance: refund.balance });
      }
      console.error("GUILD TOKEN REFUND FAILED - MANUAL REVIEW:", { username, amount: quote.price });
      return fail("The order failed and the refund needs support review. Contact support.", 500);
    }

    const at = new Date().toISOString();
    const h = await tdb(tenantId).from("purchase_history").insert([{ username, product_name: productName, duration, key_code: code, price_paid: String(quote.price), purchased_at: at, created_at: at }]);
    if (h.error) console.error("GUILD HISTORY INSERT FAILED:", h.error.message);
    try { await sendTelegramPurchase({ username, product: productName, duration, amount: quote.price, method: "Wallet", key: code, tenantId }); } catch {}
    return NextResponse.json({ success: true, code, credits, newBalance: debit.balance }, { headers: NO_STORE });
  } catch (e) {
    console.error("GUILD BUY ERROR:", e instanceof Error ? e.message : "unknown");
    return fail("Order failed.", 500);
  } finally {
    release(lockKey);
  }
}
