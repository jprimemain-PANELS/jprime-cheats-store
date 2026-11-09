"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Plus, RefreshCw, X } from "lucide-react";

type Store = {
  id: string; slug: string; brandName: string; status: string; inventoryMode: string; sharedStockAllowed: boolean;
  telegram: string | null; createdAt: string; domains: { host: string; verified: boolean }[];
  customers: number; resellers: number; products: number; orders: number; walletTotal: number;
  lastPurchaseAt: string | null; paymentStatus: string; planExpiresAt?: string | null; payer?: string | null;
};
type App = {
  id: string; brandName: string; slug: string; telegram: string | null; inventoryMode: string;
  email: string | null; phone: string | null; coadminUsername: string; createdAt: string;
};

const badge: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  suspended: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};
const modeLabel = (m: string) => (m === "shared_stock" ? "JPRIME shared stock" : "Own seller API / stock");
const field = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500";

export default function CoAdminManager() {
  const [stores, setStores] = useState<Store[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [rootDomain, setRootDomain] = useState<string | null>(null);
  const [dInfo, setDInfo] = useState<{ available: boolean; allowed: Record<string, boolean>; custom: Record<string, { host: string; live: boolean; dnsOk: boolean; note: string | null }>; vercelApi: boolean }>({ available: false, allowed: {}, custom: {}, vercelApi: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ brandName: "", slug: "", telegram: "", inventoryMode: "own_api", username: "", password: "", phone: "", email: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tenants", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Failed");
      setStores(j.stores); setApps(j.applications); setRootDomain(j.rootDomain); if (j.domainInfo) setDInfo(j.domainInfo);
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || "Could not load stores." });
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(body: Record<string, unknown>, label: string) {
    setBusy(label); setMsg(null);
    try {
      const res = await fetch("/api/admin/tenants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok || !j.success) setMsg({ ok: false, text: j.error || "Action failed." });
      else {
        const note = j.domainConfigured === false || (j.host === null && body.action !== "reactivate" && body.action !== "suspend")
          ? " Saved, but no domain was created because PLATFORM_ROOT_DOMAIN is not set." : j.host ? ` Live at ${j.host} once DNS is ready.` : "";
        setMsg({ ok: true, text: "Done." + (body.action === "approve" || body.action === "create" ? note : "") });
        await load();
        return true;
      }
    } catch { setMsg({ ok: false, text: "Network error." }); }
    finally { setBusy(null); }
    return false;
  }

  async function create() {
    const ok = await act({ action: "create", ...form }, "create");
    if (ok) { setShowCreate(false); setForm({ brandName: "", slug: "", telegram: "", inventoryMode: "own_api", username: "", password: "", phone: "", email: "" }); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Co-admin stores</h2>
          <p className="text-xs text-slate-400">Applications, store status and counts across every store. Only you can see this.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={() => setShowCreate((v) => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"><Plus className="h-3.5 w-3.5" />New store</button>
        </div>
      </div>

      {!loading && !rootDomain && (
        <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>No free-subdomain domain is configured. Set the environment variable <code className="font-mono">PLATFORM_ROOT_DOMAIN</code> (a neutral domain you own, with wildcard DNS and the same wildcard added in Vercel). Until then, approved stores get no web address.</p>
        </div>
      )}
      {msg && <div className={`rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>{msg.text}</div>}

      {showCreate && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 grid sm:grid-cols-2 gap-3">
          <input className={field} placeholder="Brand name" value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} />
          <input className={field} placeholder="Subdomain name (e.g. andrews)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} />
          <input className={field} placeholder="Telegram username" value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.target.value })} />
          <select className={field} value={form.inventoryMode} onChange={(e) => setForm({ ...form, inventoryMode: e.target.value })}>
            <option value="own_api">Own seller API / stock</option><option value="shared_stock">JPRIME shared stock</option>
          </select>
          <input className={field} placeholder="Co-admin username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input className={field} type="password" placeholder="Co-admin password (min 8)" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input className={field} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className={field} placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <button onClick={create} disabled={busy === "create"} className="sm:col-span-2 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">
            {busy === "create" && <Loader2 className="h-4 w-4 animate-spin" />}Create store
          </button>
        </div>
      )}

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div> : (
        <>
          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Pending applications ({apps.length})</h3>
            {apps.length === 0 ? <p className="text-xs text-slate-500">No pending applications.</p> : (
              <div className="grid gap-3">
                {apps.map((a) => (
                  <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="text-xs text-slate-300 space-y-0.5">
                      <p className="text-sm font-bold text-white">{a.brandName} <span className="font-mono text-slate-400">/ {a.slug}{rootDomain ? `.${rootDomain}` : ""}</span></p>
                      <p>Admin login: <b>{a.coadminUsername}</b> · Telegram: @{a.telegram} · {modeLabel(a.inventoryMode)}</p>
                      <p className="text-slate-400">{a.phone}{a.email ? ` · ${a.email}` : ""} · applied {new Date(a.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button disabled={!!busy} onClick={() => act({ action: "approve", id: a.id }, a.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer">
                        {busy === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Approve
                      </button>
                      <button disabled={!!busy} onClick={() => { const note = window.prompt("Reason for rejecting (shown to the applicant):") ; if (note !== null) act({ action: "reject", id: a.id, note }, a.id); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold disabled:opacity-50 cursor-pointer"><X className="h-3.5 w-3.5" />Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Stores ({stores.length})</h3>
            {stores.length === 0 ? <p className="text-xs text-slate-500">No co-admin stores yet.</p> : (
              <div className="grid gap-3">
                {stores.map((s) => (
                  <div key={s.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-white">{s.brandName} <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full border ${badge[s.status] || badge.pending}`}>{s.status}</span></p>
                        <p className="text-xs text-slate-400 font-mono">
                          {s.domains.length ? s.domains.map((d) => `${d.host}${d.verified ? "" : " (unverified)"}`).join(", ") : "no domain"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button disabled={!!busy} onClick={() => act({ action: "shared_stock", id: s.id, allowed: !s.sharedStockAllowed }, s.id)} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs cursor-pointer disabled:opacity-50">
                          Shared stock: {s.sharedStockAllowed ? "allowed" : "off"}
                        </button>
                        {s.status === "active" ? (
                          <button disabled={!!busy} onClick={() => { const r = window.prompt("Reason for suspending (required):"); if (r && r.trim()) act({ action: "suspend", id: s.id, reason: r }, s.id); }} className="px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs cursor-pointer disabled:opacity-50">Suspend</button>
                        ) : s.status === "suspended" ? (
                          <button disabled={!!busy} onClick={() => { const r = window.prompt("Reason for reactivating (required):"); if (r && r.trim()) act({ action: "reactivate", id: s.id, reason: r }, s.id); }} className="px-3 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs cursor-pointer disabled:opacity-50">Reactivate</button>
                        ) : null}
                      </div>
                    </div>
                    {dInfo.available && (
                      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-200">Own domain (big resellers)</span>
                          <button disabled={!!busy} onClick={() => act({ action: "custom_allowed", id: s.id, allowed: !dInfo.allowed[s.id] }, s.id)} className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 cursor-pointer disabled:opacity-50">
                            Custom domain: {dInfo.allowed[s.id] ? "allowed" : "off"}
                          </button>
                        </div>
                        {dInfo.custom[s.id] && (() => { const c = dInfo.custom[s.id]; return (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono">{c.host} · {c.live ? "LIVE" : c.dnsOk ? "DNS proven, waiting for you to activate" : "waiting for DNS"}</span>
                            <span className="flex gap-2">
                              {!c.live && c.dnsOk && (
                                <button disabled={!!busy} onClick={() => {
                                  if (dInfo.vercelApi || window.confirm(`Did you already add ${c.host} in Vercel (Project > Settings > Domains)?`))
                                    act({ action: "domain_activate", host: c.host, addedInVercel: true }, s.id);
                                }} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer disabled:opacity-50">Activate</button>
                              )}
                              <button disabled={!!busy} onClick={() => { if (window.confirm(`Remove ${c.host}?`)) act({ action: "domain_remove", host: c.host }, s.id); }} className="px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 cursor-pointer disabled:opacity-50">Remove</button>
                            </span>
                          </div>
                        ); })()}
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-center">
                      {[["Customers", s.customers], ["Resellers", s.resellers], ["Products", s.products], ["Orders", s.orders], ["Customer wallets", `₹${s.walletTotal.toLocaleString("en-IN")}`], ["Payment", s.paymentStatus === "not_configured" ? "Not set up" : s.paymentStatus]].map(([k, v]) => (
                        <div key={String(k)} className="rounded-lg bg-slate-950/60 border border-slate-800 px-2 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">{k}</p>
                          <p className="text-sm font-semibold text-white">{v}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500">{modeLabel(s.inventoryMode)} · Telegram @{s.telegram || "—"} · created {new Date(s.createdAt).toLocaleDateString()}{s.planExpiresAt ? ` · plan until ${new Date(s.planExpiresAt).toLocaleDateString()}${new Date(s.planExpiresAt) < new Date() ? " (EXPIRED)" : ""}` : " · no expiry"}{s.payer ? ` · wallet: ${s.payer}` : ""}{s.lastPurchaseAt ? ` · last purchase ${new Date(s.lastPurchaseAt).toLocaleDateString()}` : ""}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
