"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Loader2, Download, ArrowDownLeft, ArrowUpRight, RotateCcw, ShoppingBag, Wallet, AlertTriangle, Search, Copy, Check, RefreshCw, Clock, Printer } from "lucide-react";

type Entry = {
  id: string;
  at: string | null;
  kind: "deposit" | "admin_credit" | "admin_debit" | "wallet_purchase" | "upi_purchase" | "upi_problem" | "topup_pending" | "refund" | "other";
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
  orderId?: string;
  gateway?: string;
};

type Summary = {
  walletTopups: number;
  adminCredits: number;
  spentFromWallet: number;
  paidByUpi: number;
  refunds: number;
  purchases: number;
  problems: number;
  pendingTopups?: number;
  lastPurchaseAt?: string | null;
};

type Profile = { role: string; joinedAt: string | null; balance: number | null };
type Period = "all" | "today" | "7d" | "30d";

type Filter = "all" | "topups" | "purchases" | "problems" | "other" | "unpaid";

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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [limit, setLimit] = useState(40);
  const [copied, setCopied] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [recheckMsg, setRecheckMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
      setProfile(json.profile || null);
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
    const now = Date.now();
    const since = period === "today" ? new Date(new Date().setHours(0, 0, 0, 0)).getTime() : period === "7d" ? now - 7 * 864e5 : period === "30d" ? now - 30 * 864e5 : 0;
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter === "topups" && !(e.kind === "deposit" || e.kind === "admin_credit")) return false;
      if (filter === "purchases" && !(e.kind === "wallet_purchase" || e.kind === "upi_purchase" || e.kind === "upi_problem")) return false;
      if (filter === "problems" && !(e.keyStatus === "not_released" || e.keyStatus === "problem")) return false;
      if (filter === "other" && !(e.kind === "refund" || e.kind === "admin_debit" || e.kind === "other")) return false;
      if (filter === "unpaid" && e.kind !== "topup_pending") return false;
      if (since && !(e.at && Date.parse(e.at) >= since)) return false;
      if (q && !`${e.title} ${e.product ?? ""} ${e.duration ?? ""} ${e.keyText ?? ""} ${e.orderId ?? ""} ${e.note ?? ""} ${e.statusText ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, filter, period, query]);

  // Totals of what is on screen (changes with the filters), so "how much did he spend this week" is one tap.
  const shown = useMemo(() => {
    let inn = 0, out = 0;
    for (const e of visible) {
      if (e.kind === "topup_pending") continue;
      if (e.direction === "in") inn += e.amount; else out += e.amount;
    }
    return { inn, out };
  }, [visible]);

  // Does the wallet balance equal the balance after the newest entry? If not, something changed outside the ledger.
  const mismatch = useMemo(() => {
    if (!profile || profile.balance === null) return null;
    const last = entries.find((e) => e.balanceAfter !== null && e.kind !== "topup_pending");
    if (!last || last.balanceAfter === null) return null;
    return Math.abs(last.balanceAfter - profile.balance) > 0.01 ? { expected: last.balanceAfter, actual: profile.balance } : null;
  }, [entries, profile]);

  const byDay = useMemo(() => {
    const groups: { day: string; items: Entry[] }[] = [];
    for (const e of visible.slice(0, limit)) {
      const day = e.at ? new Date(e.at).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "Date not recorded";
      const g = groups[groups.length - 1];
      if (g && g.day === day) g.items.push(e); else groups.push({ day, items: [e] });
    }
    return groups;
  }, [visible, limit]);

  async function recheck(e: Entry) {
    if (!e.orderId) return;
    if (!window.confirm(`Ask the payment provider about ${e.orderId} again and credit @${username} ONLY if it says PAID?`)) return;
    setChecking(e.id); setRecheckMsg(null);
    try {
      const res = await fetch("/api/admin/gateway", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recheck", gateway: e.gateway === "paytm" ? "paytm" : e.gateway === "xyz" ? "xyz" : "anuj", orderId: e.orderId }) });
      const j = await res.json();
      setRecheckMsg({ ok: j.ok === true, text: String(j.message || j.error || "Done.") });
      if (j.ok === true) await load();
    } catch { setRecheckMsg({ ok: false, text: "Network error." }); }
    setChecking(null);
  }

  function copyText(id: string, text: string) {
    try { navigator.clipboard?.writeText(text); } catch {}
    setCopied(id); setTimeout(() => setCopied(null), 1400);
  }

  function downloadCsv() {
    const header = ["Date (IST)", "Type", "Product", "Duration", "Paid by", "Amount", "Direction", "Balance after", "Status", "Key", "Order ID"];
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
        e.keyText || "",
        e.orderId || "",
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
    { id: "unpaid", label: "Not credited" },
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
              {typeof (profile?.balance ?? balance) === "number" && (
                <>
                  {" · "}Current balance <span className="text-emerald-400 font-semibold">{money((profile?.balance ?? balance) as number)}</span>
                </>
              )}
            </p>
            {profile && (
              <p className="text-[11px] text-slate-500 mt-1">
                {profile.role && <span className="mr-2 rounded-md border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-slate-300">{profile.role}</span>}
                {profile.joinedAt && <>Joined {new Date(profile.joinedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</>}
                {summary?.lastPurchaseAt && <> · Last purchase {new Date(summary.lastPurchaseAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCsv}
              disabled={!visible.length}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-3 py-2 rounded-lg cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button onClick={() => window.print()} className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg cursor-pointer" title="Print this ledger">
              <Printer className="h-3.5 w-3.5" />
            </button>
            <button onClick={load} className="text-slate-300 bg-slate-800 hover:bg-slate-700 p-2 rounded-lg cursor-pointer" title="Reload"><RefreshCw className="h-3.5 w-3.5" /></button>
            <button onClick={onClose} aria-label="Close ledger" className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* summary */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 p-4 sm:p-5 pb-3">
            {chip("Wallet top-ups", money(summary.walletTopups), "border-emerald-500/30 bg-emerald-500/10 text-emerald-300")}
            {chip("Spent from wallet", money(summary.spentFromWallet), "border-indigo-500/30 bg-indigo-500/10 text-indigo-300")}
            {chip("Paid by UPI", money(summary.paidByUpi), "border-sky-500/30 bg-sky-500/10 text-sky-300")}
            {chip("Admin added", money(summary.adminCredits), "border-amber-500/30 bg-amber-500/10 text-amber-300")}
            {chip("Purchases", String(summary.purchases), "border-slate-700 bg-slate-800/60 text-slate-200")}
            {summary.refunds > 0 && chip("Refunded", money(summary.refunds), "border-teal-500/30 bg-teal-500/10 text-teal-300")}
            {summary.problems > 0 && chip("Problems", String(summary.problems), "border-rose-500/40 bg-rose-500/10 text-rose-300")}
            {(summary.pendingTopups ?? 0) > 0 && chip("Not credited", String(summary.pendingTopups), "border-amber-500/30 bg-amber-500/10 text-amber-300")}
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

        {/* search + period + totals */}
        <div className="px-4 sm:px-5 pb-3 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input value={query} onChange={(ev) => { setQuery(ev.target.value); setLimit(40); }} placeholder="Search product, key, order ID..." className="w-full rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 outline-none pl-9 pr-3 py-2 text-xs text-slate-200" />
            </div>
            <div className="flex gap-1.5">
              {([["all", "All time"], ["today", "Today"], ["7d", "7 days"], ["30d", "30 days"]] as [Period, string][]).map(([id, label]) => (
                <button key={id} onClick={() => { setPeriod(id); setLimit(40); }} className={`text-[11px] font-semibold px-2.5 py-2 rounded-lg border cursor-pointer ${period === id ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"}`}>{label}</button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Showing {visible.length} of {entries.length} entries · money in <span className="text-emerald-400 font-semibold">{money(shown.inn)}</span> · money out <span className="text-slate-200 font-semibold">{money(shown.out)}</span>
          </p>
          {mismatch && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
              Balance check: the ledger says the wallet should be <b>{money(mismatch.expected)}</b> but it is <b>{money(mismatch.actual)}</b>. Something changed the balance outside these records - look at the newest entries.
            </div>
          )}
          {recheckMsg && <div className={`rounded-lg border px-3 py-2 text-[11px] ${recheckMsg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>{recheckMsg.text}</div>}
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
            byDay.map((g) => (
              <div key={g.day} className="space-y-2">
                <p className="sticky top-0 z-10 bg-slate-900/95 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{g.day}</p>
                {g.items.map((e) => {
              const isPurchase = e.kind === "wallet_purchase" || e.kind === "upi_purchase" || e.kind === "upi_problem";
              const bad = e.keyStatus === "not_released" || e.keyStatus === "problem";
              const Icon = e.kind === "topup_pending"
                ? Clock
                : bad
                ? AlertTriangle
                : isPurchase
                ? ShoppingBag
                : e.kind === "refund"
                ? RotateCcw
                : e.direction === "in"
                ? ArrowDownLeft
                : ArrowUpRight;
              const tone = e.kind === "topup_pending"
                ? "text-amber-300 bg-amber-500/10"
                : bad
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
                      <p className="text-[11px] text-slate-500 mt-0.5 font-mono break-all select-all">
                        Key: {e.keyText}
                        <button onClick={() => copyText(e.id, e.keyText!)} className="ml-2 inline-flex align-middle text-slate-400 hover:text-white cursor-pointer" aria-label="Copy key">{copied === e.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}</button>
                      </p>
                    )}
                    {e.orderId && (
                      <p className="text-[11px] text-slate-500 mt-0.5 font-mono break-all select-all">
                        Order: {e.orderId}
                        <button onClick={() => copyText(`o${e.id}`, e.orderId!)} className="ml-2 inline-flex align-middle text-slate-400 hover:text-white cursor-pointer" aria-label="Copy order id">{copied === `o${e.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}</button>
                      </p>
                    )}
                    {e.kind === "topup_pending" && e.orderId && (
                      <button onClick={() => recheck(e)} disabled={checking === e.id} className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-600/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-600/30 disabled:opacity-50 cursor-pointer">
                        {checking === e.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}Credit if paid
                      </button>
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
                      {e.kind === "topup_pending" ? "" : e.direction === "in" ? "+" : "−"}
                      {money(e.amount)}
                    </p>
                    <p className="text-[10px] text-slate-500 tabular-nums flex items-center justify-end gap-1">
                      <Wallet className="h-3 w-3" />
                      {e.balanceAfter === null ? "—" : money(e.balanceAfter)}
                    </p>
                  </div>
                </div>
              );
                })}
              </div>
            ))
          )}
          {visible.length > limit && (
            <button onClick={() => setLimit((n) => n + 60)} className="mx-auto block rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer">Show more ({visible.length - limit} left)</button>
          )}
          {truncated && (
            <p className="text-[11px] text-amber-400 text-center pt-2">Showing the most recent 3000 entries.</p>
          )}
        </div>
      </div>
    </div>
  );
}
