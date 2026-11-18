import { NextRequest, NextResponse } from "next/server";
import { requireUser, rateLimit } from "@/lib/auth";
import { acquire, creditWallet, debitWallet, getBalance, logWalletTransaction, release } from "@/lib/wallet";
import { creditsKey, isTokenCode, tokenKey } from "@/lib/guild-glory";
import { NO_STORE, fail, guildGate } from "../_shared";

export const dynamic = "force-dynamic";

/**
 * Redeem a token into guild credits. The token is a hidden wallet row: taking its whole balance is one atomic
 * database step, so two people (or two clicks) can never both redeem the same token.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { username } = auth.user;
  const tenantId = auth.tenant.id;
  const blocked = guildGate(auth.tenant, tenantId);
  if (blocked) return blocked;
  if (!rateLimit(`guild-redeem:${tenantId}:${username}`, 10, 60_000)) return fail("Too many attempts. Please wait a minute.", 429);
  const lockKey = `guild-redeem:${tenantId}:${username}`;
  if (!acquire(lockKey)) return fail("Another request is in progress.", 409);
  try {
    const b = await request.json().catch(() => ({}));
    const code = String(b?.code ?? "").trim().toUpperCase();
    if (!isTokenCode(code)) return fail("Enter a valid token (looks like GG-XXXX-XXXX-XXXX-XXXX).", 400);
    const amount = await getBalance(tenantId, tokenKey(code));
    if (!amount || amount <= 0) return fail("This token is invalid or already used.", 400);
    const took = await debitWallet(tenantId, tokenKey(code), amount);
    if (!took.ok) return fail("This token is invalid or already used.", 400);
    const added = await creditWallet(tenantId, creditsKey(username), amount);
    if (!added.ok) {
      await creditWallet(tenantId, tokenKey(code), amount); // put the token back, nothing lost
      return fail("Could not add the credits. Your token is still valid, try again.", 500);
    }
    await logWalletTransaction({ tenantId, username, type: "guild_redeem", amount: 0, balance_after: added.balance, description: `Guild token redeemed: +${amount} credits` });
    return NextResponse.json({ success: true, added: amount, credits: added.balance }, { headers: NO_STORE });
  } catch (e) {
    console.error("GUILD REDEEM ERROR:", e instanceof Error ? e.message : "unknown");
    return fail("Redeem failed.", 500);
  } finally {
    release(lockKey);
  }
}
