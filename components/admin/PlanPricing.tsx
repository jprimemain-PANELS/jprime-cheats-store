"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Tag } from "lucide-react";

type Cfg = { prices: { weekly: number; monthly: number; quarterly: number }; trialDays: number; maxTrialDays: number };
const NAMES: [keyof Cfg["prices"], string, string][] = [["weekly", "Weekly", "7 days"], ["monthly", "Monthly", "30 days"], ["quarterly", "3 Months", "90 days"]];

/** Edit the subscription prices and the free-trial length that THIS store sells (owner: for the main website; own-web co-admin: for their sub-stores). */
export default function PlanPricing({ title = "Subscription prices & free trial", help }: { title?: string; help?: string }) {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [f, setF] = useState({ weekly: "", monthly: "", quarterly: "", trialDays: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/plans", { cache: "no-store" });
      const j = await r.json();
      if (j.success) { setCfg(j); setF({ weekly: String(j.prices.weekly), monthly: String(j.prices.monthly), quarterly: String(j.prices.quarterly), trialDays: String(j.trialDays) }); }
      else setMsg({ ok: false, text: j.error || "Could not load." });
    } catch { setMsg({ ok: false, text: "Network error." }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prices: { weekly: Number(f.weekly), monthly: Number(f.monthly), quarterly: Number(f.quarterly) }, trialDays: Number(f.trialDays) }) });
      const j = await r.json();
      if (!r.ok || !j.success) setMsg({ ok: false, text: j.error || "Could not save." });
      else { setMsg({ ok: true, text: "Saved. New launches and renewals use these prices now." }); await load(); }
    } catch { setMsg({ ok: false, text: "Network error." }); }
    setBusy(false);
  }

  if (!cfg) return <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">{msg ? <p className="text-xs text-rose-300">{msg.text}</p> : <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}</div>;

  const inp = "w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500";
  const monthly3 = Number(f.monthly) * 3;
  const save3 = monthly3 > 0 && Number(f.quarterly) > 0 ? Math.round((1 - Number(f.quarterly) / monthly3) * 100) : 0;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-center gap-2"><Tag className="h-4 w-4 text-indigo-400" /><h3 className="text-sm font-bold text-white">{title}</h3></div>
      <p className="text-[11px] text-slate-400">{help || "Change what a store pays for its plan and how many days it gets free the first time. Stores already running keep their current days; the new price applies to the next payment."}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {NAMES.map(([k, label, days]) => (
          <div key={k}>
            <label className="text-[11px] text-slate-400 block mb-1">{label} price ₹ <span className="text-slate-600">({days})</span></label>
            <input inputMode="numeric" className={inp} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value.replace(/[^0-9]/g, "") })} />
          </div>
        ))}
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Free trial days <span className="text-slate-600">(1-{cfg.maxTrialDays})</span></label>
          <input inputMode="numeric" className={inp} value={f.trialDays} onChange={(e) => setF({ ...f, trialDays: e.target.value.replace(/[^0-9]/g, "") })} />
        </div>
      </div>
      {save3 > 0 && <p className="text-[11px] text-emerald-300">3 Months will show "Save {save3}%" to buyers.</p>}
      {msg && <p className={`rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>{msg.text}</p>}
      <button onClick={save} disabled={busy} className="min-h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-5 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer">{busy ? "Saving..." : "Save prices"}</button>
    </div>
  );
}
