"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Youtube, BadgeIndianRupee } from "lucide-react";

type Opt = { tutorialOn: boolean; tutorialUrl: string; upgradeOn: boolean; upgradePrice: number };
const field = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500";

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${on ? "bg-emerald-500" : "bg-slate-700"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/** Tutorial video box + "customer can become reseller" price. Used by the owner and every co-admin (own store only). */
export default function StoreOptionsCard() {
  const [o, setO] = useState<Opt | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const j = await (await fetch("/api/admin/store-options", { cache: "no-store" })).json();
        if (j.success) setO(j.options);
      } catch {}
    })();
  }, []);
  if (!o) return null;

  async function save() {
    if (!o) return;
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/store-options", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutorialOn: o.tutorialOn, tutorialUrl: o.tutorialUrl, upgradeOn: o.upgradeOn, upgradePrice: o.upgradePrice }) });
      const j = await res.json();
      if (j.success) { setO(j.options); setMsg({ ok: true, text: "Saved." }); } else setMsg({ ok: false, text: j.error || "Could not save." });
    } catch { setMsg({ ok: false, text: "Network error." }); }
    setSaving(false);
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <h3 className="text-sm font-bold text-white">Store options</h3>
      {msg && <div className={`rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>{msg.text}</div>}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><p className="flex items-center gap-1.5 text-sm font-semibold text-white"><Youtube className="h-4 w-4 text-rose-400" />"How to use this site" video</p>
            <p className="text-[11px] text-slate-400">Shows a small help box on your login page. Paste a YouTube link.</p></div>
          <Switch on={o.tutorialOn} onChange={(v) => setO({ ...o, tutorialOn: v })} label="Tutorial box" />
        </div>
        <input className={field} value={o.tutorialUrl} maxLength={300} placeholder="https://youtu.be/..." onChange={(e) => setO({ ...o, tutorialUrl: e.target.value })} />
      </div>

      <div className="space-y-2 border-t border-slate-800 pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><p className="flex items-center gap-1.5 text-sm font-semibold text-white"><BadgeIndianRupee className="h-4 w-4 text-amber-400" />Customer can upgrade to reseller</p>
            <p className="text-[11px] text-slate-400">Customers pay this price from their wallet and become a reseller automatically.</p></div>
          <Switch on={o.upgradeOn} onChange={(v) => setO({ ...o, upgradeOn: v })} label="Upgrade to reseller" />
        </div>
        <label className="block text-xs text-slate-400">Price (Rs)
          <input className={field} type="number" min={1} max={100000} value={o.upgradePrice} onChange={(e) => setO({ ...o, upgradePrice: Number(e.target.value) })} />
        </label>
      </div>

      <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save options
      </button>
    </div>
  );
}
