"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, Wallet } from "lucide-react";

type Plan = { label: string; price: number; days: number; note: string };
type S = { owner?: boolean; available: boolean; expiresAt: string | null; expired: boolean; daysLeft: number | null; walletBalance: number | null; plans: Record<string, Plan>; trialDays: number };

export default function SubscriptionManager() {
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try { const r = await fetch("/api/admin/subscription", { cache: "no-store" }); const j = await r.json(); if (j.success) setS(j); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  async function pay(plan: string, p: Plan) {
    if (!window.confirm(`Pay ₹${p.price} from your wallet for the ${p.label} plan (${p.days} days)?`)) return;
    setBusy(plan); setMsg(null);
    try {
      const r = await fetch("/api/admin/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const j = await r.json();
      if (!r.ok || !j.success) setMsg({ ok: false, text: j.error || "Payment failed." });
      else { setMsg({ ok: true, text: `Paid. Your store is active until ${new Date(j.expiresAt).toLocaleDateString()}.` }); await load(); }
    } catch { setMsg({ ok: false, text: "Network error." }); }
    setBusy(null);
  }

  if (!s) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  if (s.owner) return <p className="text-sm text-slate-400">The main store has no subscription.</p>;

  const status = !s.available ? "Subscriptions are not switched on yet." : s.expiresAt === null ? "No expiry (your plan is managed by the platform owner)."
    : s.expired ? "Your plan has ENDED. Customers cannot buy until you renew."
    : `Active. ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left (until ${new Date(s.expiresAt).toLocaleDateString()}).`;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-indigo-400" /><h2 className="text-lg font-bold text-white">Subscription</h2></div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className={`rounded-xl border p-4 ${s.expired ? "border-rose-500/30 bg-rose-500/10" : "border-slate-800 bg-slate-900/60"}`}>
          <p className="text-xs text-slate-400">Your plan</p>
          <p className="text-sm text-white mt-1">{status}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="flex items-center gap-1.5 text-xs text-slate-400"><Wallet className="h-3.5 w-3.5" />Your wallet balance</p>
          <p className="text-2xl font-bold text-white mt-1">{s.walletBalance === null ? "—" : `₹${s.walletBalance.toLocaleString("en-IN")}`}</p>
          <a href="https://jprimecheats.store" className="text-[11px] text-indigo-300 underline">Add money on the main website</a>
        </div>
      </div>

      {msg && <div className={`rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>{msg.text}</div>}

      {s.available && (
        <div className="grid sm:grid-cols-3 gap-3">
          {Object.entries(s.plans).map(([k, p]) => (
            <div key={k} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center space-y-2">
              <p className="text-sm font-semibold text-white">{p.label}</p>
              <p className="text-2xl font-bold text-white">₹{p.price}</p>
              <p className="text-[11px] text-slate-400">{p.days} days{p.note ? ` · ${p.note}` : ""}</p>
              <button disabled={!!busy} onClick={() => pay(k, p)} className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer">
                {busy === k ? "Paying..." : "Pay from wallet"}
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-slate-500">New days are added after your current days, nothing is lost. Free trial is only for the first time ({s.trialDays} days).</p>
    </div>
  );
}
