"use client";

import { useEffect, useState } from "react";
import { Loader2, Wand2, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Scope } from "@/lib/price-math";
import {
  CARD,
  ChangeFields,
  DEFAULT_CHANGE,
  ScopePicker,
  Segmented,
  adminCall,
  loadPriceBookRows,
  toProductOptions,
  type ChangeSettings,
  type ProductOption,
} from "@/components/admin/bulk-controls";

type Target = "retail" | "reseller" | "both";

interface Change {
  product_name: string;
  duration: string;
  old_retail: number;
  new_retail: number;
  old_reseller: number | null;
  new_reseller: number | null;
}

/** Pricing tab: change many prices at once (all / a category / chosen products). */
export default function BulkPriceTool({ onApplied }: { onApplied?: () => void }) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [scope, setScope] = useState<Scope>({ type: "all" });
  const [target, setTarget] = useState<Target>("retail");
  const [change, setChange] = useState<ChangeSettings>(DEFAULT_CHANGE);

  const [busy, setBusy] = useState<"" | "preview" | "apply">("");
  const [preview, setPreview] = useState<{ total: number; skipped: number; sample: Change[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    loadPriceBookRows()
      .then((rows) => setProducts(toProductOptions(rows)))
      .catch((e) => setError(e?.message || "Could not load products."));
  }, []);

  // Any change to the settings makes an old preview invalid.
  useEffect(() => {
    setPreview(null);
  }, [scope, target, change]);

  const payload = (action: "preview" | "apply") => ({
    action,
    scope,
    target,
    mode: change.mode,
    value: Number(change.value),
    round: change.round,
  });

  async function runPreview() {
    setBusy("preview");
    setError(null);
    setNotice(null);
    try {
      const data = await adminCall("/api/admin/price-bulk", { method: "POST", body: JSON.stringify(payload("preview")) });
      setPreview({ total: data.total, skipped: data.skipped, sample: data.sample || [] });
    } catch (e: any) {
      setError(e?.message || "Preview failed.");
    } finally {
      setBusy("");
    }
  }

  async function runApply() {
    if (!preview) return;
    if (!window.confirm(`Change ${preview.total} prices now? Customers will see the new prices immediately.`)) return;

    setBusy("apply");
    setError(null);
    try {
      const data = await adminCall("/api/admin/price-bulk", { method: "POST", body: JSON.stringify(payload("apply")) });
      setNotice(`Done. ${data.changed} prices changed${data.skipped ? `, ${data.skipped} skipped (price would be below ₹1)` : ""}.`);
      setPreview(null);
      onApplied?.();
    } catch (e: any) {
      setError(e?.message || "Apply failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
        <div className="h-7 w-7 rounded-lg bg-indigo-500/15 text-indigo-300 flex items-center justify-center">
          <Wand2 className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide">Bulk price change</h2>
          <p className="text-[11px] text-slate-500">Change many prices in one go instead of one by one.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-300">1. Which products?</p>
            <ScopePicker products={products} value={scope} onChange={setScope} />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-300">2. Which price?</p>
            <Segmented<Target>
              value={target}
              options={[
                { value: "retail", label: "Customer price" },
                { value: "reseller", label: "Reseller price" },
                { value: "both", label: "Both" },
              ]}
              onChange={setTarget}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-300">3. How much?</p>
          <ChangeFields value={change} onChange={setChange} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          onClick={runPreview}
          disabled={busy !== ""}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer"
        >
          {busy === "preview" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Preview changes
        </button>

        <button
          onClick={runApply}
          disabled={!preview || preview.total === 0 || busy !== ""}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer"
        >
          {busy === "apply" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {preview ? `Apply to ${preview.total} prices` : "Apply"}
        </button>

        <span className="text-[11px] text-slate-500">Always preview first. Nothing changes until you press Apply.</span>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3.5 py-3">
          <AlertTriangle className="h-3.5 w-3.5 text-rose-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-rose-300">{error}</p>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3.5 py-3">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-emerald-300">{notice}</p>
        </div>
      )}

      {preview && (
        <div className="space-y-2">
          <p className="text-xs text-slate-300">
            <b>{preview.total}</b> prices will change
            {preview.skipped > 0 && <span className="text-amber-300"> · {preview.skipped} skipped (would go below ₹1)</span>}
            {preview.sample.length < preview.total && <span className="text-slate-500"> · showing first {preview.sample.length}</span>}
          </p>
          <div className="max-h-72 overflow-auto rounded-xl border border-slate-800">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-950 text-slate-400 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Product</th>
                  <th className="text-left px-3 py-2 font-semibold">Duration</th>
                  {target !== "reseller" && <th className="text-right px-3 py-2 font-semibold">Customer price</th>}
                  {target !== "retail" && <th className="text-right px-3 py-2 font-semibold">Reseller price</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {preview.sample.map((c) => (
                  <tr key={`${c.product_name}::${c.duration}`} className="text-slate-300">
                    <td className="px-3 py-1.5 truncate max-w-[220px]">{c.product_name}</td>
                    <td className="px-3 py-1.5">{c.duration}</td>
                    {target !== "reseller" && (
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        ₹{c.old_retail} → <b className="text-white">₹{c.new_retail}</b>
                      </td>
                    )}
                    {target !== "retail" && (
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {c.old_reseller != null ? `₹${c.old_reseller}` : "—"} → <b className="text-white">₹{c.new_reseller}</b>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
