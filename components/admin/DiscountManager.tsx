"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Percent, Loader2, Save, Trash2, Power, Pencil, AlertTriangle, CheckCircle2, X, Zap } from "lucide-react";
import { isRuleActive, sanitizeRules, type DiscountRule } from "@/lib/discounts";
import { applyPercentOff, type Scope } from "@/lib/price-math";
import {
  CARD,
  INPUT,
  ScopePicker,
  adminCall,
  categoryLabel,
  loadPriceBookRows,
  toProductOptions,
  type ProductOption,
} from "@/components/admin/bulk-controls";

const QUICK = [5, 10, 15, 20, 25, 30];

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO -> value for <input type="datetime-local"> (browser local time). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function describeScope(scope: Scope): string {
  if (scope.type === "all") return "All products";
  if (scope.type === "category") return `${categoryLabel(scope.category)} products`;
  return `${scope.products.length} chosen product${scope.products.length === 1 ? "" : "s"}`;
}

function statusOf(rule: DiscountRule, now: Date): { label: string; tone: string } {
  if (!rule.enabled) return { label: "OFF", tone: "text-slate-400 border-slate-700 bg-slate-800" };
  if (rule.endsAt && new Date(rule.endsAt) <= now) return { label: "ENDED", tone: "text-rose-300 border-rose-500/30 bg-rose-500/10" };
  if (rule.startsAt && new Date(rule.startsAt) > now) return { label: "SCHEDULED", tone: "text-amber-300 border-amber-500/30 bg-amber-500/10" };
  return { label: "LIVE", tone: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" };
}

const EMPTY = {
  id: "",
  label: "",
  percent: "10",
  scope: { type: "all" } as Scope,
  startsAt: "",
  endsAt: "",
  enabled: true,
};

export default function DiscountManager() {
  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminCall("/api/admin/discounts");
      setRules(sanitizeRules(data.rules));
    } catch (e: any) {
      setError(e?.message || "Could not load discounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadPriceBookRows()
      .then((rows) => setProducts(toProductOptions(rows)))
      .catch(() => undefined);
  }, [load]);

  const now = new Date();
  const editing = Boolean(form.id);
  const percentNumber = Number(form.percent);
  const exampleOk = Number.isFinite(percentNumber) && percentNumber >= 1 && percentNumber <= 90;

  const liveCount = useMemo(() => rules.filter((r) => isRuleActive(r, new Date())).length, [rules]);

  async function post(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const data = await adminCall("/api/admin/discounts", { method: "POST", body: JSON.stringify(body) });
      setRules(sanitizeRules(data.rules));
      return true;
    } catch (e: any) {
      setError(e?.message || "Request failed.");
      return false;
    } finally {
      setBusy("");
    }
  }

  async function save() {
    if (form.scope.type === "products" && form.scope.products.length === 0) {
      setError("Tick at least one product, or choose All products.");
      return;
    }
    const ok = await post(
      {
        action: "save",
        rule: {
          id: form.id || undefined,
          label: form.label.trim() || "Sale",
          percent: percentNumber,
          scope: form.scope,
          startsAt: fromLocalInput(form.startsAt),
          endsAt: fromLocalInput(form.endsAt),
          enabled: form.enabled,
        },
      },
      "save"
    );
    if (ok) {
      setNotice(editing ? "Discount updated." : "Discount created. It is live for customers now (if it has started).");
      setForm({ ...EMPTY });
    }
  }

  async function quick(percent: number) {
    if (!window.confirm(`Start ${percent}% OFF on ALL products now? You can switch it off any time.`)) return;
    const ok = await post(
      { action: "save", rule: { label: "Store Sale", percent, scope: { type: "all" }, startsAt: null, endsAt: null, enabled: true } },
      `quick${percent}`
    );
    if (ok) setNotice(`${percent}% OFF is live on all products.`);
  }

  function edit(rule: DiscountRule) {
    setError(null);
    setNotice(null);
    setForm({
      id: rule.id,
      label: rule.label,
      percent: String(rule.percent),
      scope: rule.scope,
      startsAt: toLocalInput(rule.startsAt),
      endsAt: toLocalInput(rule.endsAt),
      enabled: rule.enabled,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function endIn(hours: number | null) {
    if (hours == null) return setForm({ ...form, endsAt: "" });
    setForm({ ...form, endsAt: toLocalInput(new Date(Date.now() + hours * 3600_000).toISOString()) });
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* LEFT: create / edit */}
      <div className="xl:col-span-5 space-y-5">
        <div className={CARD}>
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <div className="h-7 w-7 rounded-lg bg-fuchsia-500/15 text-fuchsia-300 flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Quick sale on everything</h2>
              <p className="text-[11px] text-slate-500">One click. Customers see the old price crossed out.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((p) => (
              <button
                key={p}
                onClick={() => quick(p)}
                disabled={busy !== ""}
                className="px-3.5 py-2 rounded-lg text-xs font-bold bg-fuchsia-600/20 border border-fuchsia-500/40 text-fuchsia-200 hover:bg-fuchsia-600/40 disabled:opacity-50 cursor-pointer"
              >
                {busy === `quick${p}` ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : `${p}% OFF`}
              </button>
            ))}
          </div>
        </div>

        <div className={CARD}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-indigo-500/15 text-indigo-300 flex items-center justify-center">
                <Percent className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-white tracking-wide">{editing ? "Edit discount" : "New discount"}</h2>
            </div>
            {editing && (
              <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer">
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Name (shown to customers)</label>
            <input className={INPUT} placeholder="e.g. Diwali Sale" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Discount %</label>
            <div className="flex items-center gap-3">
              <input
                className={`${INPUT} max-w-[110px] text-sm font-bold`}
                inputMode="numeric"
                value={form.percent}
                onChange={(e) => setForm({ ...form, percent: e.target.value.replace(/[^\d.]/g, "") })}
              />
              <span className="text-xs text-slate-400">%</span>
              {exampleOk && <span className="text-[11px] text-slate-500">Example: ₹500 → ₹{applyPercentOff(500, percentNumber)}</span>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Applies to</label>
            <ScopePicker products={products} value={form.scope} onChange={(scope) => setForm({ ...form, scope })} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">When (optional)</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Starts</p>
                <input type="datetime-local" className={INPUT} value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Ends</p>
                <input type="datetime-local" className={INPUT} value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                { label: "No end", h: null },
                { label: "24 hours", h: 24 },
                { label: "3 days", h: 72 },
                { label: "7 days", h: 168 },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => endIn(o.h)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold border bg-slate-950 border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">With an end time, customers see a countdown on the product card.</p>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            Switched on
          </label>

          <button
            onClick={save}
            disabled={busy !== ""}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold text-xs px-4 py-2.5 rounded-xl cursor-pointer"
          >
            {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {editing ? "Save changes" : "Create discount"}
          </button>
        </div>
      </div>

      {/* RIGHT: list */}
      <div className="xl:col-span-7 space-y-4">
        {error && (
          <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3.5 py-3">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-rose-300 leading-relaxed">{error}</p>
          </div>
        )}
        {notice && (
          <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3.5 py-3">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-emerald-300">{notice}</p>
          </div>
        )}

        <div className={CARD}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white tracking-wide">
              Discounts ({rules.length}) {liveCount > 0 && <span className="ml-2 text-[11px] text-emerald-300">{liveCount} live now</span>}
            </h2>
            {liveCount > 0 && (
              <button
                onClick={() => window.confirm("Switch OFF every discount now?") && post({ action: "stop_all" }, "stop")}
                disabled={busy !== ""}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg cursor-pointer"
              >
                <Power className="h-3 w-3" /> Stop all
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            </div>
          ) : rules.length === 0 ? (
            <p className="text-xs text-slate-500 leading-relaxed">
              No discounts yet. Press a % button on the left for an instant sale on everything, or create a custom one.
              Discounts lower the customer price only. Reseller / VIP prices are not discounted again.
            </p>
          ) : (
            rules.map((rule) => {
              const status = statusOf(rule, now);
              return (
                <div key={rule.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {rule.label} <span className="text-fuchsia-300">· {rule.percent}% OFF</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {describeScope(rule.scope)}
                        {rule.endsAt && ` · ends ${new Date(rule.endsAt).toLocaleString("en-IN")}`}
                        {rule.startsAt && new Date(rule.startsAt) > now && ` · starts ${new Date(rule.startsAt).toLocaleString("en-IN")}`}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${status.tone}`}>{status.label}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => post({ action: "toggle", id: rule.id, enabled: !rule.enabled }, rule.id)}
                      disabled={busy !== ""}
                      className="bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-100 text-[11px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
                    >
                      {rule.enabled ? "Switch off" : "Switch on"}
                    </button>
                    <button
                      onClick={() => edit(rule)}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-[11px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => window.confirm(`Delete "${rule.label}"?`) && post({ action: "delete", id: rule.id }, rule.id)}
                      disabled={busy !== ""}
                      className="ml-auto flex items-center gap-1.5 text-rose-400 hover:bg-rose-500/10 text-[11px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}

          <p className="text-[11px] text-slate-500 leading-relaxed">
            If two discounts cover the same product, the bigger one is used (they never add up). The price a customer pays is always
            calculated again on the server at checkout.
          </p>
        </div>
      </div>
    </div>
  );
}
