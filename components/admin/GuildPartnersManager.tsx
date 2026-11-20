"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, Loader2, Plus, Power, Trash2 } from "lucide-react";

const field = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500";

/** Owner: connect other people's websites to Guild Glory through THIS website (they never get your seller website or key). */
export default function GuildPartnersManager() {
  const [list, setList] = useState<any[]>([]);
  const [base, setBase] = useState("");
  const [form, setForm] = useState({ name: "", username: "", cost: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [shown, setShown] = useState<{ name: string; key: string } | null>(null);

  async function load() {
    try { const j = await (await fetch("/api/admin/guild-partners", { cache: "no-store" })).json(); if (j.success) { setList(j.partners); setBase(j.base); } } catch {}
  }
  useEffect(() => { load(); }, []);

  async function call(body: any, name = "") {
    setBusy(true); setMsg(null);
    try {
      const j = await (await fetch("/api/admin/guild-partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
      if (!j.success) setMsg({ ok: false, text: j.error || "Failed." });
      else { if (j.key) setShown({ name: name || body.name || "Partner", key: j.key }); setMsg({ ok: true, text: "Done." }); if (body.action === "create") setForm({ name: "", username: "", cost: "" }); await load(); }
    } catch { setMsg({ ok: false, text: "Network error." }); }
    setBusy(false);
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <h2 className="text-lg font-bold text-white">Guild Glory partners (other websites)</h2>
      <p className="text-xs text-slate-400">Give a partner an API key for THIS website. Their own website calls it, every group costs their wallet on this website your price for one token, and the bots still run from your Guild Glory seller. They never see your seller website, key or hosting. Partner docs: <b>GUILD_PARTNER_API.md</b>.</p>
      {msg && <div className={`rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>{msg.text}</div>}
      {shown && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
          <p className="text-sm font-bold text-amber-300">API key for {shown.name} — copy it now, it is shown only once</p>
          <code className="block break-all rounded bg-black/40 p-2 text-xs text-white select-all">{shown.key}</code>
          <p className="text-xs text-slate-300">API address: <b>{base}/api/partner/guild</b></p>
          <button onClick={() => navigator.clipboard?.writeText(shown.key)} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white cursor-pointer"><Copy className="h-3.5 w-3.5" />Copy key</button>
          <button onClick={() => setShown(null)} className="ml-2 text-xs text-slate-400 underline cursor-pointer">I saved it</button>
        </div>
      )}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <p className="text-sm font-semibold text-white">Add a partner</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <input className={field} placeholder="Partner name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={field} placeholder="Wallet username (on this site)" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input className={field} placeholder="₹ per group (empty = reseller price)" inputMode="decimal" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
        </div>
        <p className="text-[11px] text-slate-500">The wallet username must be an account on this website. The partner tops up that wallet like any user; each group is charged from it.</p>
        <button disabled={busy} onClick={() => call({ action: "create", ...form })} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create partner + key</button>
      </div>
      <div className="space-y-2">
        {list.length === 0 && <p className="text-xs text-slate-500">No partners yet.</p>}
        {list.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{p.name} <span className={`ml-1 text-[10px] ${p.active ? "text-emerald-400" : "text-rose-400"}`}>{p.active ? "ACTIVE" : "DISABLED"}</span></p>
              <p className="text-[11px] text-slate-400">wallet: {p.username} · key {p.keyHint} · {p.cost > 0 ? `₹${p.cost}/group` : "reseller price"}</p>
            </div>
            <button disabled={busy} onClick={() => call({ action: "toggle", id: p.id, active: !p.active })} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer"><Power className="h-3.5 w-3.5" />{p.active ? "Disable" : "Enable"}</button>
            <button disabled={busy} onClick={() => window.confirm("Make a new key? The old key stops working.") && call({ action: "rotate", id: p.id }, p.name)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer"><KeyRound className="h-3.5 w-3.5" />New key</button>
            <button disabled={busy} onClick={() => window.confirm("Delete this partner?") && call({ action: "remove", id: p.id })} className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 px-2.5 py-1.5 text-xs text-rose-300 cursor-pointer"><Trash2 className="h-3.5 w-3.5" />Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
