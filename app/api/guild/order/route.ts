import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { tdb } from "@/lib/tenant-db";
import { OWNER_TENANT_ID, canTransact, SUSPENDED_MESSAGE } from "@/lib/tenant";
import { requireUser, rateLimit } from "@/lib/auth";
import { getTrustedQuote } from "@/lib/pricing";
import { sendTelegramPurchase } from "@/lib/telegram";
import { acquire, creditWallet, debitWallet, logWalletTransaction, release } from "@/lib/wallet";
import { isGuildId, isGuildRegion, regionLabel, startGuildBot } from "@/lib/guild-glory";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ success: false, error, ...extra }, { status, headers: NO_STORE });

/**
 * Guild Glory order, paid from the wallet. Same safety rules as a key purchase:
 * buyer = session user, price computed on the server, wallet debited first, refunded if the seller fails.
 * Only products the store admin marked as a Guild product (data.kind === "guild") can be ordered here.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { username, role } = auth.user;
  const tenantId = auth.tenant.id;
  if (!canTransact(auth.tenant)) return fail(SUSPENDED_MESSAGE, 403);
  // The seller account is the platform owner's, so this service runs on the main store only for now.
  if (tenantId !== OWNER_TENANT_ID) return fail("This service is not available in this store.", 403);
  if (!rateLimit(`guild-buy:${tenantId}:${username}`, 8, 60_000)) return fail("Too many requests. Please wait a moment.", 429);
  const lockKey = `guild-buy:${tenantId}:${username}`;
  if (!acquire(lockKey)) return fail("Another order is already in progress.", 409);

  try {
    const b = await request.json().catch(() => ({}));
    const productName = String(b?.product_name ?? "").trim();
    const duration = String(b?.duration ?? "").trim();
    const region = String(b?.region ?? "").trim();
    const guildId = String(b?.guild_id ?? "").trim();
    if (!productName || !duration) return fail("Choose a plan.", 400);
    if (!isGuildRegion(region)) return fail("Choose your account region.", 400);
    if (!isGuildId(guildId)) return fail("Enter the correct Guild / Clan ID (numbers only).", 400);

    const cat = await tdb(tenantId).from("products_catalog").select("data").eq("name", productName).maybeSingle();
    if (cat.error || (cat.data as any)?.data?.kind !== "guild") return fail("This service is not available.", 404);

    const quote = await getTrustedQuote({ tenantId, username, role, productName, duration });
    if (!quote.ok) return fail(quote.error, quote.httpStatus);
    if (quote.status === "MAINTENANCE") return fail("This service is under maintenance. Please check back soon.", 409);

    const debit = await debitWallet(tenantId, username, quote.price);
    if (!debit.ok) return fail(debit.reason === "insufficient" ? "Insufficient wallet balance." : "Could not process wallet payment.", debit.reason === "insufficient" ? 400 : 500);
    await logWalletTransaction({ tenantId, username, type: "purchase", amount: quote.price, balance_after: debit.balance, description: `Guild Glory: ${guildId} ${region} (${duration})` });

    const reference = `GG-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    let result: Awaited<ReturnType<typeof startGuildBot>>;
    try { result = await startGuildBot({ guildId, region, duration, reference }); }
    catch { result = { success: false, error: "Guild Glory service failed." }; }

    if (!result.success) {
      const refund = await creditWallet(tenantId, username, quote.price);
      if (refund.ok) {
        await logWalletTransaction({ tenantId, username, type: "refund", amount: quote.price, balance_after: refund.balance, description: `Refund (Guild Glory failed): ${guildId}` });
        return fail("Could not start the bot right now. You were not charged.", 502, { newBalance: refund.balance });
      }
      console.error("GUILD REFUND FAILED - MANUAL REVIEW:", { username, amount: quote.price, guildId });
      return fail("The order failed and the refund needs support review. Contact support.", 500);
    }

    const at = new Date().toISOString();
    const summary = `Guild ${guildId} (${regionLabel(region)}) - Order ${result.ref}`;
    const h = await tdb(tenantId).from("purchase_history").insert([{ username, product_name: productName, duration, key_code: summary, price_paid: String(quote.price), purchased_at: at, created_at: at }]);
    if (h.error) console.error("GUILD HISTORY INSERT FAILED:", h.error.message);
    try { await sendTelegramPurchase({ username, product: productName, duration, amount: quote.price, method: "Wallet", key: summary, tenantId }); } catch {}

    return NextResponse.json({ success: true, ref: result.ref, newBalance: debit.balance, message: "Bot is joining your guild and will start playing." }, { headers: NO_STORE });
  } catch (e) {
    console.error("GUILD ORDER ERROR:", e instanceof Error ? e.message : "unknown");
    return fail("Order failed.", 500);
  } finally {
    release(lockKey);
  }
}
