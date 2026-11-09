"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe, Loader2, RefreshCw } from "lucide-react";

type State = {
  available: boolean; allowed: boolean; subdomain: string | null; slugHost: string | null; kind: string;
  custom: null | { host: string; status: "waiting_dns" | "waiting_owner" | "live"; txtName: string; txtValue: string; aRecord: string; cname: string; lastCheckAt: string | null; note: string | null };
};
const field = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500";
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex flex-wrap gap-x-3 text-xs"><span className="w-20 text-slate-500">{k}</span><code className="font-mono text-slate-100 break-all select-all">{v}</code></div>
);

export default function DomainManager() {
  const [st, setSt] = useState<State | null>(null);
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try { const r = await fetch("/api/admin/domain", { cache: "no-store" }); const j = await r.json(); if (j.success) setSt(j); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/domain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const j = await r.json();
      if (!r.ok || !j.success) setMsg({ ok: false, text: j.error || "Failed." });
      else { setMsg({ ok: true, text: j.note || "Done." }); if (j.state) setSt((p) => (p ? { ...p, ...j.state } : p)); else await load(); }
    } catch { setMsg({ ok: false, text: "Network error." }); } finally { setBusy(false); }
  }

  if (!st) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  const c = st.custom;
  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2"><Globe className="h-5 w-5 text-indigo-400" /><h2 className="text-lg font-bold text-white">Your website address</h2></div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
        <p className="text-xs text-slate-400">Free address (always works)</p>
        <p className="font-mono text-sm text-white">{st.subdomain || st.slugHost || "Not available yet"}</p>
      </div>

      {st.kind === "owner" ? <p className="text-xs text-slate-400">This is the main store; its domains are managed by the platform.</p>
        : !st.available ? <p className="text-xs text-slate-400">Custom domains are not enabled on the platform yet.</p>
        : !st.allowed && !c ? <p className="text-xs text-slate-400">Using your own domain (like shop.yourname.com) is available for selected stores. Ask the platform owner to enable it for you.</p>
        : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <p className="text-sm font-semibold text-white">Use your own domain</p>
            <p className="text-xs text-slate-400">You need to own a domain (bought from any registrar). Subdomains like <b>shop.yourname.com</b> are easiest.</p>
            {msg && <div className={`rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>{msg.text}</div>}

            {!c && (
              <div className="flex gap-2">
                <input className={field} placeholder="shop.yourname.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
                <button disabled={busy || !domain.trim()} onClick={() => act("request", { domain })} className="px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer whitespace-nowrap">Get steps</button>
              </div>
            )}

            {c && (
              <div className="space-y-4">
                <p className="text-sm text-white font-mono">{c.host} <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full border border-slate-600 text-slate-300">
                  {c.status === "live" ? "LIVE" : c.status === "waiting_owner" ? "DNS OK – waiting for activation" : "waiting for DNS"}</span></p>
                {c.status !== "live" && (
                  <>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-200">Step 1. At your domain provider, add this record to prove it is yours:</p>
                      <Row k="Type" v="TXT" /><Row k="Name" v={c.txtName} /><Row k="Value" v={c.txtValue} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-200">Step 2. Point the domain to the platform (one of these):</p>
                      <Row k="CNAME" v={`${c.host.split(".").length > 2 ? c.host.split(".")[0] : "@"}  →  ${c.cname}`} />
                      <p className="text-[11px] text-slate-500">For a bare domain with no prefix, use an A record to <code className="font-mono">{c.aRecord}</code> instead.</p>
                    </div>
                    <p className="text-xs text-slate-300">Step 3. Press <b>Check DNS</b>. When the proof is found, your domain is switched on (automatically, or by the platform owner).</p>
                  </>
                )}
                {c.note && <p className="text-xs text-slate-400">{c.note}</p>}
                <div className="flex gap-2">
                  {c.status !== "live" && <button disabled={busy} onClick={() => act("check")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Check DNS</button>}
                  <button disabled={busy} onClick={() => { if (window.confirm("Remove this domain?")) act("remove"); }} className="px-3 py-2 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs cursor-pointer disabled:opacity-50">Remove</button>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
