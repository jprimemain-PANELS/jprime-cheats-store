/**
 * Builds one readable, newest-first ledger for a single user from the tables the site already
 * writes:
 *   wallet_transactions : deposits, admin credits/debits, wallet purchases, refunds
 *   purchase_history    : every delivered key (wallet AND direct UPI purchases) + the key itself
 *   deposit_history     : wallet top-up attempts (used only to recover missing times)
 *   payment_orders      : UPI orders (used only to show payments whose key was NOT released)
 *
 * A wallet purchase exists in BOTH wallet_transactions and purchase_history, so it is merged into
 * ONE line ("Paid by Wallet", with the balance after). A purchase with no matching wallet debit
 * was paid directly by UPI. Pure logic: no database, no network.
 */

export type LedgerKind =
  | "deposit"
  | "admin_credit"
  | "admin_debit"
  | "wallet_purchase"
  | "upi_purchase"
  | "upi_problem"
  | "refund"
  | "other";

export type KeyStatus = "released" | "not_released" | "problem" | "pending";

export type LedgerEntry = {
  id: string;
  /** ISO time, or null when the database never stored one. */
  at: string | null;
  kind: LedgerKind;
  title: string;
  product?: string;
  duration?: string;
  amount: number;
  direction: "in" | "out";
  method: "WALLET" | "UPI" | "ADMIN" | "—";
  /** Wallet balance right after this event. For UPI purchases it is the balance at that time. */
  balanceAfter: number | null;
  note?: string;
  /** Only for purchases / failed payments: was the product key released? */
  keyStatus?: KeyStatus;
  keyText?: string;
  statusText?: string;
};

export type LedgerSummary = {
  walletTopups: number;
  adminCredits: number;
  spentFromWallet: number;
  paidByUpi: number;
  refunds: number;
  purchases: number;
  problems: number;
};

type Row = Record<string, unknown>;

const MATCH_WINDOW_MS = 10 * 60 * 1000;
const STUCK_AFTER_MS = 15 * 60 * 1000;

const num = (value: unknown): number => {
  const n = parseFloat(String(value ?? "").replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const numOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const parseTime = (value: unknown): number => {
  if (value === null || value === undefined || value === "") return 0;
  const t = typeof value === "number" ? value : Date.parse(String(value));
  return Number.isFinite(t) && t > 946684800000 ? t : 0; // anything before year 2000 = "not recorded"
};

/** Different installs name the time column differently; use whichever holds a real date. */
const rowTime = (row: Row): number =>
  parseTime(row.created_at) ||
  parseTime(row.purchased_at) ||
  parseTime(row.timestamp) ||
  parseTime(row.date) ||
  parseTime(row.inserted_at) ||
  parseTime(row.createdAt);

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const idNum = (row: Row): number => {
  const n = Number(row.id);
  return Number.isFinite(n) ? n : NaN;
};

function classifyTx(tx: Row): { kind: LedgerKind; title: string; direction: "in" | "out"; method: LedgerEntry["method"] } {
  const type = String(tx.type ?? "").toLowerCase();
  const description = String(tx.description ?? "");

  if (type === "purchase") return { kind: "wallet_purchase", title: "Purchase", direction: "out", method: "WALLET" };
  if (type === "refund") return { kind: "refund", title: "Refund", direction: "in", method: "WALLET" };
  if (type === "deposit") return { kind: "deposit", title: "Wallet top-up", direction: "in", method: "UPI" };

  if (type === "credit") {
    return /admin/i.test(description)
      ? { kind: "admin_credit", title: "Funds added by admin", direction: "in", method: "ADMIN" }
      : { kind: "deposit", title: "Wallet credit", direction: "in", method: "—" };
  }
  if (type === "debit") {
    return /admin/i.test(description)
      ? { kind: "admin_debit", title: "Funds removed by admin", direction: "out", method: "ADMIN" }
      : { kind: "other", title: "Wallet debit", direction: "out", method: "WALLET" };
  }
  return { kind: "other", title: type || "Wallet entry", direction: "in", method: "—" };
}

/** "Purchase: Product Name (30 day)" -> { product, duration } */
function parseDescription(description: string): { product?: string; duration?: string } {
  const m = /^(?:Refund \(delivery failed\)|Purchase):\s*(.*)\s\(([^()]*)\)\s*$/.exec(description.trim());
  return m ? { product: m[1], duration: m[2] } : {};
}

const isRefundForFailedDelivery = (description: string) => /^Refund \(delivery failed\)/i.test(description.trim());

const SUCCESS_WORDS = ["success", "successful", "completed", "complete", "paid", "credited", "verified"];

export function buildUserLedger(
  transactions: Row[],
  purchases: Row[],
  extra: { deposits?: Row[]; orders?: Row[]; now?: number } = {}
): { entries: LedgerEntry[]; summary: LedgerSummary } {
  const now = extra.now ?? Date.now();

  /* Wallet rows in chronological order. The row id is the most reliable order; time is the fallback. */
  const txs = transactions
    .map((tx, index) => ({ tx, index, at: rowTime(tx) }))
    .sort((a, b) => {
      const ia = idNum(a.tx);
      const ib = idNum(b.tx);
      if (Number.isFinite(ia) && Number.isFinite(ib) && ia !== ib) return ia - ib;
      return a.at - b.at || a.index - b.index;
    });

  /* 0) Recover missing top-up times from deposit_history (same amount, oldest first). */
  const depositTimes = (extra.deposits || [])
    .filter((d) => SUCCESS_WORDS.includes(String(d.status ?? "").toLowerCase()))
    .map((d) => ({ amount: round2(num(d.amount)), at: parseTime(d.updated_at) || rowTime(d), used: false }))
    .filter((d) => d.at > 0)
    .sort((a, b) => a.at - b.at);

  for (const t of txs) {
    if (t.at > 0) continue;
    const type = String(t.tx.type ?? "").toLowerCase();
    if (type !== "deposit" && !(type === "credit" && /deposit/i.test(String(t.tx.description ?? "")))) continue;
    const hit = depositTimes.find((d) => !d.used && Math.abs(d.amount - round2(num(t.tx.amount))) <= 0.01);
    if (hit) {
      hit.used = true;
      t.at = hit.at;
    }
  }

  const usedTx = new Set<number>();
  const entries: LedgerEntry[] = [];

  /* 1) Match every delivered purchase with its wallet debit (if it has one). */
  const purchaseList = purchases
    .map((p, index) => ({ p, index, at: rowTime(p) }))
    .sort((a, b) => a.at - b.at || a.index - b.index);

  for (const { p, index, at } of purchaseList) {
    const product = String(p.product_name ?? "");
    const duration = String(p.duration ?? "");
    const paid = round2(num(p.price_paid));
    const wanted = `Purchase: ${product} (${duration})`;
    const key = String(p.key_code ?? "").trim();

    let best = -1;
    let bestGap = Infinity;
    txs.forEach((t, i) => {
      if (usedTx.has(i)) return;
      if (String(t.tx.type ?? "").toLowerCase() !== "purchase") return;
      if (String(t.tx.description ?? "").trim() !== wanted) return;
      if (Math.abs(round2(num(t.tx.amount)) - paid) > 0.01) return;

      // When either time is unknown, pair in order (oldest purchase with oldest unmatched debit).
      const gap = t.at > 0 && at > 0 ? Math.abs(t.at - at) : 0;
      if (t.at > 0 && at > 0 && gap > MATCH_WINDOW_MS) return;
      if (gap < bestGap) {
        best = i;
        bestGap = gap;
      }
    });

    const status = key
      ? { keyStatus: "released" as KeyStatus, keyText: key, statusText: "Key released" }
      : { keyStatus: "problem" as KeyStatus, statusText: "Purchase saved but the key is missing" };

    if (best >= 0) {
      usedTx.add(best);
      const when = at || txs[best].at;
      entries.push({
        id: `p${String(p.id ?? index)}`,
        at: when ? new Date(when).toISOString() : null,
        kind: "wallet_purchase",
        title: "Purchased",
        product,
        duration,
        amount: paid,
        direction: "out",
        method: "WALLET",
        balanceAfter: numOrNull(txs[best].tx.balance_after),
        ...status,
      });
    } else {
      // Not paid from the wallet: the wallet balance did not change. Show the balance at that time.
      let balanceThen: number | null = null;
      if (at > 0) {
        let latest = 0;
        for (const t of txs) {
          if (t.at > 0 && t.at <= at && t.at >= latest) {
            latest = t.at;
            balanceThen = numOrNull(t.tx.balance_after);
          }
        }
      }
      entries.push({
        id: `p${String(p.id ?? index)}`,
        at: at ? new Date(at).toISOString() : null,
        kind: "upi_purchase",
        title: "Purchased",
        product,
        duration,
        amount: paid,
        direction: "out",
        method: "UPI",
        balanceAfter: balanceThen,
        ...status,
      });
    }
  }

  /* 2) Refunds for failed deliveries pair with the wallet debit they reverse. */
  const refundOf = new Map<number, number>(); // purchase tx index -> refund tx index
  txs.forEach((r, ri) => {
    if (usedTx.has(ri) || String(r.tx.type ?? "").toLowerCase() !== "refund") return;
    const description = String(r.tx.description ?? "");
    if (!isRefundForFailedDelivery(description)) return;
    const { product, duration } = parseDescription(description);
    if (!product) return;
    const wanted = `Purchase: ${product} (${duration})`;

    const pi = txs.findIndex(
      (t, i) =>
        !usedTx.has(i) &&
        !refundOf.has(i) &&
        i < ri &&
        String(t.tx.type ?? "").toLowerCase() === "purchase" &&
        String(t.tx.description ?? "").trim() === wanted &&
        Math.abs(round2(num(t.tx.amount)) - round2(num(r.tx.amount))) <= 0.01
    );
    if (pi >= 0) refundOf.set(pi, ri);
  });
  const refundedTx = new Set(refundOf.values());

  /* 3) Every other wallet movement (and wallet purchases that have no history row). */
  txs.forEach((t, i) => {
    if (usedTx.has(i)) return;
    const c = classifyTx(t.tx);
    const parsed = parseDescription(String(t.tx.description ?? ""));

    const entry: LedgerEntry = {
      id: `t${String(t.tx.id ?? i)}`,
      at: t.at ? new Date(t.at).toISOString() : null,
      kind: c.kind,
      title: c.title,
      product: parsed.product,
      duration: parsed.duration,
      amount: round2(Math.abs(num(t.tx.amount))),
      direction: c.direction,
      method: c.method,
      balanceAfter: numOrNull(t.tx.balance_after),
      note: c.kind === "other" ? String(t.tx.description ?? "") : undefined,
    };

    if (c.kind === "wallet_purchase") {
      entry.title = "Purchase";
      if (refundOf.has(i)) {
        entry.keyStatus = "not_released";
        entry.statusText = "Key NOT released: delivery failed, amount refunded";
      } else {
        entry.keyStatus = "problem";
        entry.statusText = "No key record found for this purchase";
      }
    } else if (c.kind === "refund" && refundedTx.has(i)) {
      entry.statusText = "Refunded to wallet";
    }

    entries.push(entry);
  });

  /* 4) UPI payments that did NOT end with a released key. */
  for (const [index, o] of (extra.orders || []).entries()) {
    const status = String(o.status ?? "").toLowerCase();
    const at = rowTime(o);
    const base = {
      id: `o${String(o.id ?? o.gateway_order_id ?? index)}`,
      at: at ? new Date(at).toISOString() : null,
      kind: "upi_problem" as LedgerKind,
      title: "UPI payment",
      product: String(o.product_name ?? ""),
      duration: String(o.duration ?? ""),
      amount: round2(num(o.amount)),
      direction: "out" as const,
      method: "UPI" as const,
      balanceAfter: null,
    };

    if (status === "delivery_failed") {
      entries.push({ ...base, keyStatus: "not_released", statusText: "Key NOT released: payment received but delivery failed, check manually" });
    } else if (status === "processing") {
      const stuck = at > 0 && now - at > STUCK_AFTER_MS;
      entries.push({
        ...base,
        keyStatus: stuck ? "problem" : "pending",
        statusText: stuck ? "Stuck while processing: check this order" : "Processing…",
      });
    } else if (status === "amount_mismatch") {
      entries.push({ ...base, keyStatus: "problem", statusText: "Paid amount did not match the order" });
    } else if (status === "duplicate_utr") {
      entries.push({ ...base, keyStatus: "problem", statusText: "Payment reference (UTR) was already used" });
    }
    // pending / expired / success: not a problem (success is shown from purchase_history).
  }

  /* Newest first; entries without a stored time go to the bottom (newest id first). */
  entries.sort((a, b) => {
    const ta = a.at ? Date.parse(a.at) : 0;
    const tb = b.at ? Date.parse(b.at) : 0;
    if (ta !== tb) return tb - ta;
    return b.id.localeCompare(a.id, undefined, { numeric: true });
  });

  const summary: LedgerSummary = {
    walletTopups: 0,
    adminCredits: 0,
    spentFromWallet: 0,
    paidByUpi: 0,
    refunds: 0,
    purchases: 0,
    problems: 0,
  };
  for (const e of entries) {
    if (e.kind === "deposit") summary.walletTopups += e.amount;
    else if (e.kind === "admin_credit") summary.adminCredits += e.amount;
    else if (e.kind === "wallet_purchase" && e.keyStatus === "released") {
      summary.spentFromWallet += e.amount;
      summary.purchases += 1;
    } else if (e.kind === "upi_purchase") {
      summary.paidByUpi += e.amount;
      summary.purchases += 1;
    } else if (e.kind === "refund") summary.refunds += e.amount;
    if (e.keyStatus === "not_released" || e.keyStatus === "problem") summary.problems += 1;
  }
  // A wallet debit whose key was never released is not a completed purchase, but the money left the wallet.
  for (const e of entries) {
    if (e.kind === "wallet_purchase" && e.keyStatus !== "released") summary.spentFromWallet += e.amount;
  }
  for (const k of Object.keys(summary) as (keyof LedgerSummary)[]) summary[k] = round2(summary[k]);

  return { entries, summary };
}
