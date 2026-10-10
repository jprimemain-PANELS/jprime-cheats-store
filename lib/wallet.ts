import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Wallet helpers. All balance changes go through compare-and-swap updates
 * (`update ... where balance = <value we read>`), so two concurrent requests
 * can never both spend / credit the same starting balance.
 * Uses the service-role client; callers must have authenticated the user first.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;
const MAX_ATTEMPTS = 8;

export type WalletResult =
  | { ok: true; balance: number }
  | { ok: false; reason: "insufficient" | "invalid" | "error"; balance?: number };

export async function getBalance(username: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("wallets")
    .select("balance")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    console.error("WALLET READ ERROR:", error.message);
    return null;
  }
  return data ? Number(data.balance ?? 0) : 0;
}

/** Returns the balance, creating a zero wallet if the user has none (own wallet only). */
export async function getOrCreateBalance(username: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("wallets")
    .select("balance")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    console.error("WALLET READ ERROR:", error.message);
    return null;
  }
  if (data) return Number(data.balance ?? 0);

  const { error: insertError } = await supabaseAdmin
    .from("wallets")
    .insert({ username, balance: 0 });

  if (insertError) {
    // Possibly created concurrently – re-read.
    const again = await getBalance(username);
    return again;
  }
  return 0;
}

export async function debitWallet(username: string, amount: number): Promise<WalletResult> {
  const amt = round2(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, reason: "invalid" };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: wallet, error } = await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("username", username)
      .maybeSingle();

    if (error || !wallet) return { ok: false, reason: "error" };

    const current = Number(wallet.balance ?? 0);
    if (!Number.isFinite(current)) return { ok: false, reason: "error" };
    if (current < amt) return { ok: false, reason: "insufficient", balance: current };

    const next = round2(current - amt);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("wallets")
      .update({ balance: next })
      .eq("username", username)
      .eq("balance", wallet.balance)
      .select("balance")
      .maybeSingle();

    if (updateError) {
      console.error("WALLET DEBIT ERROR:", updateError.message);
      return { ok: false, reason: "error" };
    }
    if (updated) return { ok: true, balance: Number(updated.balance) };
    // balance changed under us -> retry with the fresh value
  }
  return { ok: false, reason: "error" };
}

export async function creditWallet(username: string, amount: number): Promise<WalletResult> {
  const amt = round2(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, reason: "invalid" };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: wallet, error } = await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("username", username)
      .maybeSingle();

    if (error) return { ok: false, reason: "error" };

    if (!wallet) {
      const { data: created, error: insertError } = await supabaseAdmin
        .from("wallets")
        .insert({ username, balance: amt })
        .select("balance")
        .maybeSingle();
      if (created) return { ok: true, balance: Number(created.balance) };
      if (insertError) continue; // created concurrently -> retry as update
      continue;
    }

    const next = round2(Number(wallet.balance ?? 0) + amt);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("wallets")
      .update({ balance: next })
      .eq("username", username)
      .eq("balance", wallet.balance)
      .select("balance")
      .maybeSingle();

    if (updateError) {
      console.error("WALLET CREDIT ERROR:", updateError.message);
      return { ok: false, reason: "error" };
    }
    if (updated) return { ok: true, balance: Number(updated.balance) };
  }
  return { ok: false, reason: "error" };
}

/** Ledger entry. Never throws; a ledger failure must not lose a completed purchase. */
export async function logWalletTransaction(entry: {
  username: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
}) {
  try {
    const { error } = await supabaseAdmin.from("wallet_transactions").insert(entry);
    if (error) console.error("WALLET LEDGER ERROR:", error.message);
  } catch (e) {
    console.error("WALLET LEDGER EXCEPTION:", e);
  }
}

/* Per-user in-flight guard (best effort on serverless; the CAS above is the real protection). */
const inflight = new Set<string>();
export function acquire(key: string): boolean {
  if (inflight.has(key)) return false;
  inflight.add(key);
  return true;
}
export function release(key: string) {
  inflight.delete(key);
}
