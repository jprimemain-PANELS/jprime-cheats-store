"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Store } from "lucide-react";
import PlanPricing from "@/components/admin/PlanPricing";

type Sub = { id: string; brandName: string; slug: string; host: string | null; status: string; expiresAt: string | null; expired: boolean; daysLeft: number | null; payer: string | null; createdAt: string | null };

/** Shown only to a co-admin whose owner chose "their own web": plan prices + every sub-co-admin their resellers launched. */
export default function SubStoresManager() {
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const load = useCallback(async () => {
    try { const j = await (await fetch("/api/admin/sub-stores", { cache: "no-store" })).json(); setSubs(j.success ? j.stores : []); } catch { setSubs([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const badge = (s: Sub) => s.status === "active" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-rose-500/15 text-rose-300 border-rose-500/30";
  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2"><Store className="h-5 w-5 text-indigo-400" /><h2 className="text-lg font-bold text-white">Sub-stores</h2></div>
      <p className="text-xs text-slate-400">Your resellers can launch their own website from your store. They pay <b className="text-slate-200">you</b>, from their wallet on your website, at the prices below.</p>

      <PlanPricing title="Your sub-store prices & free trial" help="Set what your resellers pay for their own website and how many days they get free the first time. A reseller's wallet balance on your website is charged, so make sure they add money to your wallet first." />

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Your sub-co-admins {subs ? `(${subs.length})` : ""}</h3>
          <button onClick={load} aria-label="Refresh" className="p-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"><RefreshCw className="h-4 w-4" /></button>
        </div>
        {!subs ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : subs.length === 0 ? (
          <p className="text-xs text-slate-500">No one has launched a website yet. Tell your resellers to open "Launch your website" on your store.</p>
        ) : (
          <div className="space-y-2">
            {subs.map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{s.brandName}</p>
                  {s.host && <a href={`https://${s.host}`} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-300 underline break-all">{s.host}</a>}
                  <p className="text-[11px] text-slate-400 mt-0.5">Reseller: <b className="text-slate-200">{s.payer ?? "-"}</b>{s.createdAt ? ` · launched ${new Date(s.createdAt).toLocaleDateString("en-IN")}` : ""}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${badge(s)}`}>{s.status}</span>
                  <p className="text-[11px] text-slate-400 mt-1">{s.expiresAt === null ? "No expiry" : s.expired ? "Plan ended" : `${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left`}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
