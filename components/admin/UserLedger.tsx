"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Loader2, Download, ArrowDownLeft, ArrowUpRight, RotateCcw, ShoppingBag, Wallet, AlertTriangle } from "lucide-react";

type Entry = {
  id: string;
  at: string | null;
  kind: "deposit" | "admin_credit" | "admin_debit" | "wallet_purchase" | "upi_purchase" | "upi_problem" | "refund" | "other";
  title: string;
  product?: string;
  duration?: string;
  amount: number;
  direction: "in" | "out";
  method: "WALLET" | "UPI" | "ADMIN" | "—";
  balanceAfter: number | null;
  note?: string;
  keyStatus?: "released" | "not_released" | "problem" | "pending";
  keyText?: string;
  statusText?: string;
};

type Summary = {
  walletTopups: number;
  adminCredits: number;
  spentFromWallet: number;
  paidByUpi: number;
  refunds: number;
  purchases: number;
  problems: number;
};

type Filter = "all" | "topups" | "purchases" | "problems" | "other";

const money = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const when = (iso: string | null) =>
  !iso
    ? "Time not recorded"
    : new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

// Stops spreadsheet formulas ("=...", "+...") in product names from running when the CSV is opened.
const csvCell = (value: unknown) => {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export default function UserLedger({
  username,
  balance,
  onClose,
}: {
  username: string;
  balance?: number;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/user-ledger?username=${encodeURIComponent(username)}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.error || "Could not load the ledger.");
      setEntries(json.entries || []);
      setSummary(json.summary || null);
      setTruncated(Boolean(json.truncated));
    } catch (err: any) {
      setError(err?.message || "Could not load the ledger.");
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    if (filter === "topups") return entries.filter((e) => e.kind === "deposit" || e.kind === "admin_credit");
    if (filter === "purchases") return entries.filter((e) => e.kind === "wallet_purchase" || e.kind === "upi_purchase" || e.kind === "upi_problem");
    if (filter === "problems") return entries.filter((e) => e.keyStatus === "not_released" || e.keyStatus === "problem");
    if (filter === "other") return entries.filter((e) => e.kind === "refund" || e.kind === "admin_debit" || e.kind === "other");
    return entries;
  }, [entries, filter]);

  function downloadCsv() {
    const header = ["Date (IST)", "Type", "Product", "Duration", "Paid by", "Amount", "Direction", "Balance after", "Key status"];
    const lines = visible.map((e) =>
      [
        when(e.at),
        e.title,
        e.product || "",
        e.duration || "",
        e.method,
        e.amount.toFixed(2),
        e.direction === "in" ? "IN" : "OUT",
        e.balanceAfter === null ? "" : e.balanceAfter.toFixed(2),
        e.statusText || "",
      ]
        .map(csvCell)
        .join(",")
    );
    const blob = new Blob([[header.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-${username}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const chip = (label: string, value: string, tone: string) => (
    <div className={`rounded-xl border px-3 py-2 ${tone}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-sm font-bold tabular-nums">{value}</p>
    </div>
  );

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "topups", label: "Wallet top-ups" },
    { id: "purchases", label: "Purchases" },
    { id: "problems", label: "Problems" },
    { id: "other", label: "Refunds & other" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white">Account ledger — @{username}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Every wallet top-up and purchase, newest first
              {typeof balance === "number" && (
                <>
                  {" · "}Current balance <span className="text-emerald-400 font-semibold">{money(balance)}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCsv}
              disabled={!visible.length}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-3 py-2 rounded-lg cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* summary */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-5 pb-3">
            {chip("Wallet top-ups", money(summary.walletTopups), "border-emerald-500/30 bg-emerald-500/10 text-emerald-300")}
            {chip("Spent from wallet", money(summary.spentFromWallet), "border-indigo-500/30 bg-indigo-500/10 text-indigo-300")}
            {chip("Paid by UPI", money(summary.paidByUpi), "border-sky-500/30 bg-sky-500/10 text-sky-300")}
            {chip("Admin added", money(summary.adminCredits), "border-amber-500/30 bg-amber-500/10 text-amber-300")}
            {chip("Purchases", String(summary.purchases), "border-slate-700 bg-slate-800/60 text-slate-200")}
          </div>
        )}

        {/* filters */}
        <div className="flex flex-wrap gap-1.5 px-5 pb-3">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                filter === f.id
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* list */}
        <div className="overflow-y-auto px-5 pb-5 space-y-2 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            </div>
          ) : error ? (
            <p className="text-xs text-rose-400 py-8 text-center">{error}</p>
          ) : visible.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No activity found.</p>
          ) : (
            visible.map((e) => {
              const isPurchase = e.kind === "wallet_purchase" || e.kind === "upi_purchase" || e.kind === "upi_problem";
              const bad = e.keyStatus === "not_released" || e.keyStatus === "problem";
              const Icon = bad
                ? AlertTriangle
                : isPurchase
                ? ShoppingBag
                : e.kind === "refund"
                ? RotateCcw
                : e.direction === "in"
                ? ArrowDownLeft
                : ArrowUpRight;
              const tone = bad
                ? "text-rose-400 bg-rose-500/10"
                : e.direction === "in"
                ? "text-emerald-400 bg-emerald-500/10"
                : isPurchase
                ? "text-indigo-300 bg-indigo-500/10"
                : "text-rose-400 bg-rose-500/10";
              const statusTone =
                e.keyStatus === "released"
                  ? "text-emerald-400"
                  : e.keyStatus === "pending"
                  ? "text-amber-300"
                  : e.keyStatus
                  ? "text-rose-400"
                  : "text-slate-400";

              return (
                <div key={e.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">
                      {e.title}
                      {e.product ? ` — ${e.product}` : ""}
                      {e.duration ? ` (${e.duration})` : ""}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {when(e.at)}
                      {e.statusText && (
                        <span className={`font-semibold ${statusTone}`}>
                          {" · "}
                          {e.keyStatus === "released" ? "✓ " : e.keyStatus === "pending" ? "… " : e.keyStatus ? "✗ " : ""}
                          {e.statusText}
                        </span>
                      )}
                      {e.note ? ` · ${e.note}` : ""}
                    </p>
                    {e.keyText && (
                      <p className="text-[11px] text-slate-500 mt-0.5 font-mono break-all select-all">Key: {e.keyText}</p>
                    )}
                  </div>

                  {e.method !== "—" && (
                    <span
                      className={`hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${
                        e.method === "WALLET"
                          ? "text-indigo-300 border-indigo-500/30 bg-indigo-500/10"
                          : e.method === "UPI"
                          ? "text-sky-300 border-sky-500/30 bg-sky-500/10"
                          : "text-amber-300 border-amber-500/30 bg-amber-500/10"
                      }`}
                    >
                      {isPurchase ? `Paid by ${e.method}` : e.method}
                    </span>
                  )}

                  <div className="text-right shrink-0">
                    <p className={`text-xs font-bold tabular-nums ${e.direction === "in" ? "text-emerald-400" : "text-slate-200"}`}>
                      {e.direction === "in" ? "+" : "−"}
                      {money(e.amount)}
                    </p>
                    <p className="text-[10px] text-slate-500 tabular-nums flex items-center justify-end gap-1">
                      <Wallet className="h-3 w-3" />
                      {e.balanceAfter === null ? "—" : money(e.balanceAfter)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          {truncated && (
            <p className="text-[11px] text-amber-400 text-center pt-2">Showing the most recent 3000 entries.</p>
          )}
        </div>
      </div>
    </div>
  );
}
