"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Plug, Trash2, Wallet } from "lucide-react";

const field = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500";
const btn = "px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50";
const STATUS: Record<string, { text: string; cls: string }> = {
  pending: { text: "Waiting for the platform owner", cls: "border-amber-500/30 text-amber-300" },
  in_development: { text: "Accepted. Being built (2 to 3 days)", cls: "border-sky-500/30 text-sky-300" },
  approved: { text: "Approved", cls: "border-emerald-500/30 text-emerald-300" },
  rejected: { text: "Rejected", cls: "border-rose-500/30 text-rose-300" },
};
const Badge = ({ s }: { s: string }) => <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS[s]?.cls ?? ""}`}>{STATUS[s]?.text ?? s}</span>;

async function call(body: unknown) {
  const r = await fetch("/api/admin/api-system", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok && j.success ? { ok: true as const } : { ok: false as const, error: String(j.error || "Failed.") };
}

/* =============================== OWNER VIEW =============================== */
function OwnerView({ d, reload }: { d: any; reload: () => void }) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [pick, setPick] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  async function decide(id: string, decision: string) {
    setBusy(id); setMsg("");
    const r = await call({ action: "decide", id, decision, assignedSeller: pick[id], note: note[id] });
    setBusy(""); if (!r.ok) setMsg(r.error); else reload();
  }
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-3">
        {d.sellers.map((s: any) => (
          <div key={s.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold text-white">{s.name}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${s.connected ? "border-emerald-500/30 text-emerald-300" : "border-rose-500/30 text-rose-300"}`}>{s.connected ? "Connected" : "Key missing"}</span></div>
            <p className="text-xs text-slate-400 mt-1">Your own integration. Stores using it with their own key: <b className="text-slate-200">{s.stores}</b></p>
          </div>
        ))}
      </div>
      {!d.available && <p className="text-xs text-amber-300">Run supabase/tenant/006_API_SYSTEM.sql in Supabase to switch on store requests.</p>}
      {msg && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{msg}</p>}
      <h3 className="text-sm font-bold text-white">Store requests ({d.requests.length})</h3>
      {d.requests.length === 0 && <p className="text-xs text-slate-400">No requests yet.</p>}
      {d.requests.map((r: any) => (
        <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-white"><b>{r.store}</b> · {r.kind === "own_api" ? "Their own API" : "Other seller's API"} · <span className="font-mono">{r.sellerName}</span></p>
            <Badge s={r.status} />
          </div>
          {r.endpointUrl && <p className="text-xs text-slate-300 break-all">Endpoint: <span className="font-mono">{r.endpointUrl}</span></p>}
          <p className="text-xs text-slate-300 break-all">API key: <span className="font-mono">{r.apiKey ? (show[r.id] ? r.apiKey : "••••" + r.apiKey.slice(-4)) : "not given"}</span>
            {" · "}Master: <span className="font-mono">{r.masterKey ? (show[r.id] ? r.masterKey : "••••" + r.masterKey.slice(-4)) : "not given"}</span>
            {(r.apiKey || r.masterKey) && <button className="ml-2 text-indigo-300 underline" onClick={() => setShow({ ...show, [r.id]: !show[r.id] })}>{show[r.id] ? "hide" : "show"}</button>}</p>
          {r.notes && <details className="text-xs text-slate-300"><summary className="cursor-pointer text-indigo-300">API details pasted by the store ({r.notes.length} characters)</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 text-[11px]">{r.notes}</pre></details>}
          {r.ownerNote && <p className="text-xs text-slate-400">Your note: {r.ownerNote}</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <select className={field + " !w-auto"} value={pick[r.id] ?? r.assignedSeller ?? ""} onChange={(e) => setPick({ ...pick, [r.id]: e.target.value })}>
              <option value="">Use which of your sellers?</option>
              {d.sellers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input className={field + " !w-48"} placeholder="Note for the store (optional)" maxLength={500} value={note[r.id] ?? ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} />
            <button disabled={busy === r.id} onClick={() => decide(r.id, "approve")} className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white`}>Approve</button>
            <button disabled={busy === r.id} onClick={() => decide(r.id, "in_development")} className={`${btn} border border-sky-500/30 text-sky-300 hover:bg-sky-500/10`}>I will build it</button>
            <button disabled={busy === r.id} onClick={() => decide(r.id, "reject")} className={`${btn} border border-rose-500/30 text-rose-400 hover:bg-rose-500/10`}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================== CO-ADMIN VIEW ============================== */
function StoreView({ d, reload }: { d: any; reload: () => void }) {
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<"own_api" | "other_seller" | "">("");
  const [f, setF] = useState({ sellerName: "", apiKey: "", masterKey: "", endpointUrl: "", notes: "" });
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [keys, setKeys] = useState<Record<string, { apiKey: string; masterKey: string }>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });

  async function submit() {
    setBusy("new"); setMsg(null);
    const r = await call({ action: "create", kind, ...f });
    setBusy("");
    if (!r.ok) setMsg({ ok: false, text: r.error });
    else { setMsg({ ok: true, text: "Sent. The platform owner will reply here." }); setAdding(false); setKind(""); setF({ sellerName: "", apiKey: "", masterKey: "", endpointUrl: "", notes: "" }); reload(); }
  }
  async function saveKeys(id: string) {
    setBusy(id); setMsg(null);
    const r = await call({ action: "keys", id, ...(keys[id] ?? {}) });
    setBusy(""); if (!r.ok) setMsg({ ok: false, text: r.error }); else { setMsg({ ok: true, text: "Saved." }); setKeys({ ...keys, [id]: { apiKey: "", masterKey: "" } }); reload(); }
  }
  async function remove(id: string) {
    if (!window.confirm("Remove this API?")) return;
    setBusy(id); const r = await call({ action: "delete", id }); setBusy(""); if (!r.ok) setMsg({ ok: false, text: r.error }); else reload();
  }
  const j = d.jprime;

  return (
    <div className="space-y-5">
      {msg && <div className={`rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>{msg.text}</div>}

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white">JPRIME API stock</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${j.allowed ? "border-emerald-500/30 text-emerald-300" : "border-slate-600 text-slate-400"}`}>{j.allowed ? "On" : "Not enabled"}</span>
        </div>
        <p className="text-xs text-slate-400">Sell the platform's ready API products. Choose <b>JPRIME API stock</b> when you add a product. The platform price is taken from your wallet balance for each sale. If your balance is low, your customers see "out of stock". The product ID cannot be changed.</p>
        <p className="flex items-center gap-1.5 text-xs text-slate-300"><Wallet className="h-3.5 w-3.5" />Your wallet balance: <b>{j.walletBalance === null ? "not linked" : `₹${Number(j.walletBalance).toLocaleString("en-IN")}`}</b></p>
        {!j.allowed && <p className="text-[11px] text-amber-300">{!j.sharedStockOn ? "Ask the platform owner to switch on JPRIME API stock for your store." : "The platform owner must link your wallet. Contact the owner."}</p>}
        <p className="text-[10px] text-slate-500">This card cannot be edited.</p>
      </div>

      {d.connections.map((c: any) => (
        <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">{c.assignedName ?? c.sellerName}</p>
            <div className="flex items-center gap-2"><Badge s={c.status} />
              <button disabled={busy === c.id} onClick={() => remove(c.id)} aria-label="Remove" className="text-slate-500 hover:text-rose-400 cursor-pointer"><Trash2 className="h-4 w-4" /></button></div>
          </div>
          <p className="text-[11px] text-slate-400">{c.kind === "own_api" ? "Your own API" : "Other seller's API"}{c.assignedName && c.assignedName !== c.sellerName ? ` · you asked for: ${c.sellerName}` : ""}</p>
          {c.ownerNote && <p className="text-xs text-slate-300">Owner: {c.ownerNote}</p>}
          {c.status === "approved" && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-emerald-300 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Approved. Add your own account key from {c.assignedName}. It now appears as a supplier when you add a product.</p>
              <div className="grid sm:grid-cols-2 gap-2">
                <input className={field} placeholder={c.hasKey ? `API key saved (${c.keyHint}). Type to replace` : "Your API key"} value={keys[c.id]?.apiKey ?? ""} onChange={(e) => setKeys({ ...keys, [c.id]: { apiKey: e.target.value, masterKey: keys[c.id]?.masterKey ?? "" } })} autoComplete="off" />
                <input className={field} placeholder={c.hasMaster ? `Master key saved (${c.masterHint}). Type to replace` : "Master key (if the seller gave you one)"} value={keys[c.id]?.masterKey ?? ""} onChange={(e) => setKeys({ ...keys, [c.id]: { masterKey: e.target.value, apiKey: keys[c.id]?.apiKey ?? "" } })} autoComplete="off" />
              </div>
              <button disabled={busy === c.id} onClick={() => saveKeys(c.id)} className={`${btn} bg-indigo-600 hover:bg-indigo-500 text-white`}>{busy === c.id ? "Saving..." : "Save keys"}</button>
              <p className="text-[10px] text-slate-500">Keys are never shown again, only the last 4 characters.</p>
            </div>
          )}
        </div>
      ))}

      {!adding ? (
        <button onClick={() => { setAdding(true); setMsg(null); }} disabled={!d.available} className={`${btn} bg-indigo-600 hover:bg-indigo-500 text-white`}><Plug className="inline h-3.5 w-3.5 mr-1.5" />Add your own API</button>
      ) : (
        <div className="rounded-xl border border-indigo-500/30 bg-slate-900/60 p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Whose API do you want to add?</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {([["own_api", "1. My own API", "You have your own API system."], ["other_seller", "2. Other seller's API", "You buy from another seller's website."]] as const).map(([k, t, s]) => (
              <button key={k} onClick={() => setKind(k)} className={`text-left rounded-lg border p-3 cursor-pointer ${kind === k ? "border-indigo-400 bg-indigo-500/10" : "border-slate-700"}`}><p className="text-sm text-white">{t}</p><p className="text-[11px] text-slate-400">{s}</p></button>
            ))}
          </div>
          {kind && (
            <div className="space-y-2">
              <label className="block text-xs text-slate-400">{kind === "own_api" ? "Name of your API (example: My Panel API)" : "Seller name (example: My Supplier)"}<input className={field} maxLength={60} value={f.sellerName} onChange={set("sellerName")} /></label>
              <label className="block text-xs text-slate-400">API key<input className={field} autoComplete="off" value={f.apiKey} onChange={set("apiKey")} /></label>
              <label className="block text-xs text-slate-400">Master key (only if you have one)<input className={field} autoComplete="off" value={f.masterKey} onChange={set("masterKey")} /></label>
              <label className="block text-xs text-slate-400">Endpoint URL (example: https://seller.com/api/buy.php)<input className={field} value={f.endpointUrl} onChange={set("endpointUrl")} placeholder="https://" /></label>
              <label className="block text-xs text-slate-400">Paste the full API code or documents here, with product IDs and all details, so the platform team can build it for you in 2 to 3 days.
                <textarea className={field + " h-44 font-mono text-xs"} maxLength={8000} value={f.notes} onChange={set("notes")} /></label>
              <p className="text-[10px] text-slate-500">{f.notes.length}/8000 characters. Write all the details of the API here. The platform team will check it and build it for you.</p>
              <div className="flex gap-2">
                <button disabled={busy === "new"} onClick={submit} className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white`}>{busy === "new" ? "Sending..." : "Send to platform owner"}</button>
                <button onClick={() => { setAdding(false); setKind(""); }} className={`${btn} border border-slate-700 text-slate-300`}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ApiSystemManager() {
  const [d, setD] = useState<any>(null);
  const load = useCallback(async () => {
    try { const r = await fetch("/api/admin/api-system", { cache: "no-store" }); const j = await r.json(); if (j.success) setD(j); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!d) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2"><Plug className="h-5 w-5 text-indigo-400" /><h2 className="text-lg font-bold text-white">API System</h2></div>
      {d.owner ? <OwnerView d={d} reload={load} /> : <StoreView d={d} reload={load} />}
    </div>
  );
}
