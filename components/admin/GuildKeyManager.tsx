"use client";

import { useEffect, useState } from "react";
import { Crown, Loader2, Save, Trash2 } from "lucide-react";

const field = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500";

/** Co-admin: connect YOUR Guild Glory seller account (API key) so your store can sell the Guild Glory bot with its own wallet and customers. */
export default function GuildKeyManager() {
  const [v, setV] = useState<any>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    try { const j = await (await fetch("/api/admin/guild-key", { cache: "no-store" })).json(); if (j.success) setV(j); } catch {}
  }
  useEffect(() => { load(); }, []);

  async function call(body: any, ok: string) {
    setBusy(true); setMsg(null);
    try {
      const j = await (await fetch("/api/admin/guild-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
      setMsg(j.success ? { ok: true, text: ok } : { ok: false, text: j.error || "Failed." });
      if (j.success) { setKey(""); setV(j); }
    } catch { setMsg({ ok: false, text: "Network error." }); }
    setBusy(false);
  }

  if (!v) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  return (
    <div className="space-y-4 max-w-xl">
      <h2 className="flex items-center gap-2 text-lg font-bold text-white"><Crown className="h-5 w-5 text-amber-300" />Guild Glory bot for your store</h2>
      <p className="text-xs text-slate-400">Sell the Guild Glory bot to your own customers. It runs on <b>your</b> Guild Glory seller account, so the bot cost is taken from your seller balance and customers pay you from your store wallet.</p>
      <ol className="text-xs text-slate-300 list-decimal pl-5 space-y-1">
        <li>Open your Guild Glory seller website, go to the <b>Developer Center</b> and create an <b>API key</b>.</li>
        <li>Paste the key below and press Save.</li>
        <li>Go to <b>Products</b> and press <b>Add Guild Glory</b>. Set your token prices and save.</li>
      </ol>
      {!v.serviceReady && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">The platform owner has not connected the Guild Glory service address yet. Ask support.</div>}
      {msg && <div className={`rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>{msg.text}</div>}
      <p className="text-xs text-slate-300">Status: {v.hasKey ? <b className="text-emerald-300">Connected ({v.keyHint})</b> : <b className="text-slate-400">Not connected</b>}</p>
      <label className="block text-xs text-slate-400">Seller API key
        <input className={field} type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={v.hasKey ? "Paste a new key to replace it" : "Paste your API key"} /></label>
      <div className="flex gap-2">
        <button disabled={busy || !key.trim()} onClick={() => call({ key }, "Saved. Now add the Guild Glory product in Products.")} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save key</button>
        {v.hasKey && <button disabled={busy} onClick={() => call({ clear: true }, "Disconnected.")} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 text-sm cursor-pointer disabled:opacity-50"><Trash2 className="h-4 w-4" />Disconnect</button>}
      </div>
    </div>
  );
}
