"use client";

import { useEffect, useState } from "react";
import { Loader2, Rocket } from "lucide-react";

/** ON/OFF for the "Launch Your Own Website" button that resellers see. Saves instantly. */
export default function LaunchButtonToggle() {
  const [shown, setShown] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try { const j = await (await fetch("/api/admin/store-options", { cache: "no-store" })).json(); if (j.success) setShown(j.options?.launchHidden !== true); } catch {}
    })();
  }, []);

  async function flip() {
    if (shown === null || busy) return;
    const next = !shown;
    setBusy(true); setErr("");
    try {
      const j = await (await fetch("/api/admin/store-options", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ launchHidden: !next }) })).json();
      if (j.success) setShown(next); else setErr(j.error || "Could not save.");
    } catch { setErr("Network error."); }
    setBusy(false);
  }

  if (shown === null) return null;
  return (
    <div className={`rounded-2xl border p-4 ${shown ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"}`}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-white"><Rocket className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">"Launch Your Own Website" button</p>
          <p className="text-[11px] text-slate-300">{shown ? "ON: resellers can see the button." : "OFF: the button is hidden for everyone."} Saves instantly.</p>
        </div>
        <button type="button" role="switch" aria-checked={shown} onClick={flip} disabled={busy} aria-label="Show launch button"
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors cursor-pointer disabled:opacity-60 ${shown ? "bg-emerald-500" : "bg-slate-600"}`}>
          {busy ? <Loader2 className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" /> : <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${shown ? "left-[22px]" : "left-0.5"}`} />}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
    </div>
  );
}
