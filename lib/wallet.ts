import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Wallet helpers call SECURITY DEFINER PostgreSQL functions installed by
 * WALLET_REPAIR_AND_FIX.sql. The database takes an advisory lock per exact
 * username, consolidates exact-match duplicates, and changes the balance in
 * one transaction. Usernames that differ by case or whitespace are NOT merged.
 */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type WalletResult =
  | { ok: true; balance: number }
  | { ok: false; reason: "insufficient" | "invalid" | "error"; balance?: number };

type WalletRpcResult = {
  ok?: boolean;
  reason?: string;
  balance?: number | string;
};

export async function getBalance(username: string): Promise<number | null> {
  if (typeof username !== "string" || username.length === 0) return null;
  const { data, error } = await supabaseAdmin.rpc("jprime_wallet_get_balance", {
    p_username: username,
  });
  if (error) {
    console.error("WALLET READ ERROR:", error.message);
    return null;
  }
  const balance = Number(data ?? 0);
  return Number.isFinite(balance) ? round2(balance) : null;
}

/** Returns the balance, creating a zero wallet if the user has none (own wallet only). */
export async function getOrCreateBalance(username: string): Promise<number | null> {
  if (typeof username !== "string" || username.length === 0) return null;
  const { data, error } = await supabaseAdmin.rpc("jprime_wallet_get_or_create_balance", {
    p_username: username,
  });
  if (error) {
    console.error("WALLET READ/CREATE ERROR:", error.message);
    return null;
  }
  const balance = Number(data ?? 0);
  return Number.isFinite(balance) ? round2(balance) : null;
}

export async function debitWallet(username: string, amount: number): Promise<WalletResult> {
  const amt = round2(Number(amount));
  if (typeof username !== "string" || username.length === 0 || !Number.isFinite(amt) || amt <= 0) {
    return { ok: false, reason: "invalid" };
  }

  const { data, error } = await supabaseAdmin.rpc("jprime_wallet_debit", {
    p_username: username,
    p_amount: amt,
  });
  if (error) {
    console.error("WALLET DEBIT ERROR:", error.message);
    return { ok: false, reason: "error" };
  }

  const result = data as WalletRpcResult | null;
  if (result?.ok === true) return { ok: true, balance: round2(Number(result.balance ?? 0)) };
  if (result?.reason === "insufficient") {
    return { ok: false, reason: "insufficient", balance: round2(Number(result.balance ?? 0)) };
  }
  if (result?.reason === "invalid") return { ok: false, reason: "invalid" };
  console.error("WALLET DEBIT RPC returned an unexpected response.");
  return { ok: false, reason: "error" };
}

export async function creditWallet(username: string, amount: number): Promise<WalletResult> {
  const amt = round2(Number(amount));
  if (typeof username !== "string" || username.length === 0 || !Number.isFinite(amt) || amt <= 0) {
    return { ok: false, reason: "invalid" };
  }

  const { data, error } = await supabaseAdmin.rpc("jprime_wallet_credit", {
    p_username: username,
    p_amount: amt,
  });
  if (error) {
    console.error("WALLET CREDIT ERROR:", error.message);
    return { ok: false, reason: "error" };
  }

  const result = data as WalletRpcResult | null;
  if (result?.ok === true) return { ok: true, balance: round2(Number(result.balance ?? 0)) };
  if (result?.reason === "invalid") return { ok: false, reason: "invalid" };
  console.error("WALLET CREDIT RPC returned an unexpected response.");
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

/* Per-user in-flight guard (best effort on serverless; DB lock is authoritative). */
const inflight = new Set<string>();
export function acquire(key: string): boolean {
  if (inflight.has(key)) return false;
  inflight.add(key);
  return true;
}
export function release(key: string) {
  inflight.delete(key);
}
