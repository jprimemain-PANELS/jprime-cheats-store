"use client";

import { useMemo, useState } from "react";
import { Loader2, Save, AlertTriangle } from "lucide-react";

export interface EditorTier {
  duration: string;
  /** Live price now (override or default). */
  retail: number;
  reseller: number | null;
}

export interface EditorProduct {
  name: string;
  tiers: EditorTier[];
}

export interface PriceRow {
  product_name: string;
  duration: string;
  price_inr: number;
  reseller_price: number | null;
}

const key = (name: string, duration: string) => `${name}::${duration}`;

/**
 * Every product and every duration on ONE screen. Type the new price, press Save once.
 * Only the boxes you changed are sent.
 */
export default function AllPricesEditor({
  products,
  onSave,
}: {
  products: EditorProduct[];
  onSave: (rows: PriceRow[]) => Promise<void>;
}) {
  const initial = useMemo(() => {
    const map: Record<string, { retail: string; reseller: string }> = {};
    for (const p of products)
      for (const t of p.tiers) map[key(p.name, t.duration)] = { retail: String(t.retail), reseller: t.reseller === null ? "" : String(t.reseller) };
    return map;
  }, [products]);

  const [drafts, setDrafts] = useState<Record<string, { retail: string; reseller: string }>>({});
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const value = (k: string) => drafts[k] ?? initial[k] ?? { retail: "", reseller: "" };

  const changed = useMemo(
    () =>
      Object.keys(drafts).filter((k) => {
        const a = drafts[k];
        const b = initial[k];
        return !!b && (a.retail !== b.retail || a.reseller !== b.reseller);
      }),
    [drafts, initial]
  );

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
  }, [products, filter]);

  function setField(k: string, field: "retail" | "reseller", v: string) {
    setDrafts((prev) => ({ ...prev, [k]: { ...(prev[k] ?? initial[k] ?? { retail: "", reseller: "" }), [field]: v } }));
  }

  async function save() {
    setError(null);
    setNotice(null);

    const rows: PriceRow[] = [];
    for (const p of products) {
      for (const t of p.tiers) {
        const k = key(p.name, t.duration);
        if (!changed.includes(k)) continue;
        const d = value(k);
        const retail = parseFloat(d.retail);
        const reseller = d.reseller.trim() === "" ? null : parseFloat(d.reseller);
        if (!Number.isFinite(retail) || retail < 0 || (reseller !== null && (!Number.isFinite(reseller) || reseller < 0))) {
          setError(`Invalid price for "${p.name}" / "${t.duration}".`);
          return;
        }
        rows.push({ product_name: p.name, duration: t.duration, price_inr: retail, reseller_price: reseller });
      }
    }

    if (rows.length === 0) return;

    setSaving(true);
    try {
      await onSave(rows);
      setDrafts({});
      setNotice(`${rows.length} price${rows.length === 1 ? "" : "s"} saved.`);
    } catch (e: any) {
      setError(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-slate-800">
        <h2 className="text-sm font-bold text-white tracking-wide">All products and durations</h2>
        <div className="flex items-center gap-3">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search product…"
            className="bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-100 outline-none focus:border-emerald-500 w-48"
          />
          <button
            onClick={save}
            disabled={saving || changed.length === 0}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save {changed.length > 0 ? `${changed.length} change${changed.length === 1 ? "" : "s"}` : "changes"}
          </button>
        </div>
      </div>

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

      <div className="space-y-5 max-h-[620px] overflow-y-auto pr-1 custom-scrollbar">
        {shown.map((p) => (
          <div key={p.name} className="space-y-2">
            <p className="text-xs font-bold text-white">{p.name}</p>
            <div className="grid grid-cols-[1fr_100px_100px] gap-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <span>Duration</span>
              <span className="text-right">Retail ₹</span>
              <span className="text-right">Reseller ₹</span>
            </div>
            {p.tiers.map((t) => {
              const k = key(p.name, t.duration);
              const d = value(k);
              const dirty = changed.includes(k);
              return (
                <div key={k} className={`grid grid-cols-[1fr_100px_100px] gap-3 items-center rounded-lg border px-3 py-2 ${dirty ? "border-emerald-500/50 bg-emerald-500/5" : "border-slate-800 bg-slate-950/50"}`}>
                  <span className="text-xs font-medium text-slate-300 truncate">{t.duration}</span>
                  <input
                    type="number"
                    min={0}
                    value={d.retail}
                    onChange={(e) => setField(k, "retail", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2 text-xs text-slate-100 text-right outline-none focus:border-emerald-500"
                  />
                  <input
                    type="number"
                    min={0}
                    value={d.reseller}
                    placeholder="—"
                    onChange={(e) => setField(k, "reseller", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2 text-xs text-slate-100 text-right outline-none focus:border-emerald-500 placeholder-slate-600"
                  />
                </div>
              );
            })}
          </div>
        ))}
        {shown.length === 0 && <p className="text-xs text-slate-500 py-6 text-center">No products found.</p>}
      </div>
    </div>
  );
}
