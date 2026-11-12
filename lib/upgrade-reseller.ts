import { supabaseAdmin } from "@/lib/supabase-admin";
import { debitWallet, creditWallet, logWalletTransaction, acquire, release } from "@/lib/wallet";
import { getStoreOptions } from "@/lib/store-options";

/**
 * A customer pays the store's upgrade price from THEIR wallet in THIS store and becomes a reseller.
 * Price and ON/OFF come from the server-side store options, never from the browser.
 * Order: charge first (atomic RPC) -> promote only if still a plain customer -> refund if that did not happen.
 */
export async function upgradeToReseller(tenantId: string, user: { id: string; username: string; role: string }) {
  const opts = await getStoreOptions(tenantId);
  if (!opts.upgradeOn) return { ok: false as const, error: "Upgrade is not available in this store.", status: 403 };
  if (String(user.role).toLowerCase() !== "user") return { ok: false as const, error: "Your account is already above a customer account.", status: 409 };
  const price = Math.round(opts.upgradePrice);
  if (!(price >= 1)) return { ok: false as const, error: "Upgrade is not available in this store.", status: 403 };

  const lock = `upg:${tenantId}:${user.username}`;
  if (!acquire(lock)) return { ok: false as const, error: "Please wait, your upgrade is already processing.", status: 429 };
  try {
    const debit = await debitWallet(tenantId, user.username, price);
    if (!debit.ok) {
      return debit.reason === "insufficient"
        ? { ok: false as const, error: `Not enough wallet balance. Add money first (upgrade costs ₹${price}).`, status: 402 }
        : { ok: false as const, error: "Could not charge your wallet. Try again.", status: 503 };
    }
    await logWalletTransaction({ tenantId, username: user.username, type: "debit", amount: price, balance_after: debit.balance, description: "Upgrade to reseller" });

    const upd = await supabaseAdmin.from("users").update({ role: "reseller" })
      .eq("id", user.id).eq("tenant_id", tenantId).eq("role", "user").select("id");
    const changed = Array.isArray(upd.data) ? upd.data.length : 0;
    if (upd.error || changed !== 1) {
      const back = await creditWallet(tenantId, user.username, price);
      if (back.ok) await logWalletTransaction({ tenantId, username: user.username, type: "refund", amount: price, balance_after: back.balance, description: "Refund: reseller upgrade failed" });
      return { ok: false as const, error: "Upgrade could not be completed. Your money was returned.", status: 500 };
    }
    await supabaseAdmin.from("audit_log").insert({ tenant_id: tenantId, actor_user_id: user.id, actor_username: user.username, action: "user.upgraded_to_reseller", target: user.username });
    return { ok: true as const, price, balance: debit.balance };
  } finally {
    release(lock);
  }
}
