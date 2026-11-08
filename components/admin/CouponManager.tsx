"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2, Pencil, X, AlertTriangle, Ticket, Dices } from "lucide-react";

type Coupon = {
  id: string;
  code: string;
  percent: number;
  scope: "all" | "products";
  products: string[];
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

async function couponRequest(options: RequestInit = {}) {
  const response = await fetch("/api/admin/coupons", {
    ...options,
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) throw new Error(data?.error || "Request failed.");
  return data;
}

const INPUT =
  "w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all";

// datetime-local expects local time "YYYY-MM-DDTHH:mm"
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
    : "";

const randomCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "JP";
  for (let i = 0; i < 6; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

const EMPTY = { id: "", code: "", percent: "10", scope: "all" as "all" | "products", products: [] as string[], enabled: true, startsAt: "", endsAt: "" };

export default function CouponManager({ productNames }: { productNames: string[] }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await couponRequest();
      setCoupons(data.coupons || []);
    } catch (e: any) {
      setError(e?.message || "Could not load coupons.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visibleProducts = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? productNames.filter((n) => n.toLowerCase().includes(q)) : productNames;
  }, [productNames, filter]);

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await couponRequest({
        method: "POST",
        body: JSON.stringify({
          action: "save",
          id: form.id || undefined,
          code: form.code,
          percent: Number(form.percent),
          scope: form.scope,
          products: form.scope === "products" ? form.products : [],
          enabled: form.enabled,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        }),
      });
      setCoupons(data.coupons || []);
      setNotice(form.id ? "Coupon updated." : "Coupon created. Share the code with your customers.");
      setForm({ ...EMPTY });
    } catch (e: any) {
      setError(e?.message || "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function act(body: Record<string, unknown>, okText: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await couponRequest({ method: "POST", body: JSON.stringify(body) });
      setCoupons(data.coupons || []);
      setNotice(okText);
    } catch (e: any) {
      setError(e?.message || "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  function edit(c: Coupon) {
    setError(null);
    setNotice(null);
    setForm({
      id: c.id,
      code: c.code,
      percent: String(c.percent),
      scope: c.scope,
      products: c.products,
      enabled: c.enabled,
      startsAt: toLocalInput(c.startsAt),
      endsAt: toLocalInput(c.endsAt),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const toggleProduct = (name: string) =>
    setForm((f) => ({ ...f, products: f.products.includes(name) ? f.products.filter((n) => n !== name) : [...f.products, name] }));

  const editing = Boolean(form.id);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* FORM */}
      <div className="lg:col-span-5">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                <Ticket className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-white tracking-wide">{editing ? "Edit coupon" : "Create coupon code"}</h2>
            </div>
            {editing && (
              <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer">
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            )}
          </div>

          <div className="grid grid-cols-[1fr_110px] gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 block">Coupon code</label>
              <div className="flex gap-2">
                <input
                  className={`${INPUT} font-mono tracking-wider uppercase`}
                  placeholder="e.g. SAVE10"
                  maxLength={24}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, "") })}
                />
                <button
                  type="button"
                  title="Generate a random code"
                  onClick={() => setForm({ ...form, code: randomCode() })}
                  className="shrink-0 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 rounded-xl cursor-pointer"
                >
                  <Dices className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 block">Discount %</label>
              <input className={INPUT} type="number" min={1} max={90} value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 block">Works on</label>
            <div className="flex gap-2">
              {(["all", "products"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm({ ...form, scope: s })}
                  className={`flex-1 text-xs font-semibold py-2 rounded-xl border cursor-pointer transition-colors ${
                    form.scope === s ? "bg-emerald-600 border-emerald-500 text-white" : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {s === "all" ? "All products" : "Selected products"}
                </button>
              ))}
            </div>

            {form.scope === "products" && (
              <div className="space-y-2">
                <input className={INPUT} placeholder="Search products…" value={filter} onChange={(e) => setFilter(e.target.value)} />
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 divide-y divide-slate-800/70">
                  {visibleProducts.map((name) => (
                    <label key={name} className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 cursor-pointer hover:bg-slate-900">
                      <input type="checkbox" checked={form.products.includes(name)} onChange={() => toggleProduct(name)} />
                      <span className="truncate">{name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">{form.products.length} selected</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 block">Starts (optional)</label>
              <input className={INPUT} type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 block">Ends (optional)</label>
              <input className={INPUT} type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            Enabled
          </label>

          <button
            onClick={save}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editing ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {editing ? "Save changes" : "Create coupon"}
          </button>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Customers see only the percentage on the product card (never the code). They type the code on the card and the price drops. Coupons do not apply to reseller accounts.
          </p>
        </div>
      </div>

      {/* LIST */}
      <div className="lg:col-span-7 space-y-4">
        {error && (
          <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3.5 py-3">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-rose-300 leading-relaxed">{error}</p>
          </div>
        )}
        {notice && !error && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3.5 py-2.5">
            <span className="text-[11px] text-emerald-400 font-medium">{notice}</span>
          </div>
        )}

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-bold text-white tracking-wide pb-3 border-b border-slate-800">Coupon codes ({coupons.length})</h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            </div>
          ) : coupons.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No coupons yet. Create one on the left.</p>
          ) : (
            coupons.map((c) => (
              <div key={c.id} className={`rounded-xl border p-4 space-y-2 ${c.enabled ? "border-slate-800 bg-slate-950/50" : "border-slate-800/60 bg-slate-950/20 opacity-60"}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-bold tracking-wider text-white">{c.code}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-amber-300 border border-amber-500/30 bg-amber-500/10">{c.percent}% OFF</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => edit(c)} disabled={busy} className="flex items-center gap-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 px-2.5 py-1.5 rounded-lg cursor-pointer">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => act({ action: "toggle", id: c.id, enabled: !c.enabled }, c.enabled ? "Coupon disabled." : "Coupon enabled.")}
                      disabled={busy}
                      className="text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 px-2.5 py-1.5 rounded-lg cursor-pointer"
                    >
                      {c.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => window.confirm(`Delete coupon ${c.code}?`) && act({ action: "delete", id: c.id }, "Coupon deleted.")}
                      disabled={busy}
                      className="text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  {c.scope === "all" ? "All products" : `${c.products.length} product${c.products.length === 1 ? "" : "s"}: ${c.products.slice(0, 3).join(", ")}${c.products.length > 3 ? "…" : ""}`}
                  {c.startsAt ? ` · from ${when(c.startsAt)}` : ""}
                  {c.endsAt ? ` · until ${when(c.endsAt)}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
