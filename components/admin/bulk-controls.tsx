"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { BulkMode, RoundTo, Scope } from "@/lib/price-math";

/** Small shared controls for the admin bulk tools (Pricing, Discounts, VIP Prices). */

export const INPUT =
  "w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all";

export const CARD = "bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4";

export interface ProductOption {
  name: string;
  category: string;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
            value === o.value
              ? "bg-indigo-600 border-indigo-500 text-white"
              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const CATEGORY_LABEL: Record<string, string> = { mobile: "Mobile", pc: "PC", ios: "iOS" };
export const categoryLabel = (c: string) => CATEGORY_LABEL[c] || c.toUpperCase();

/** "Which products?"  All  |  one category  |  tick products. */
export function ScopePicker({
  products,
  value,
  onChange,
}: {
  products: ProductOption[];
  value: Scope;
  onChange: (next: Scope) => void;
}) {
  const [query, setQuery] = useState("");

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))),
    [products]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [products, query]);

  const chosen = value.type === "products" ? value.products : [];

  function toggle(name: string) {
    const next = chosen.includes(name) ? chosen.filter((n) => n !== name) : [...chosen, name];
    onChange({ type: "products", products: next });
  }

  return (
    <div className="space-y-2.5">
      <Segmented
        value={value.type}
        options={[
          { value: "all", label: "All products" },
          ...(categories.length ? [{ value: "category" as const, label: "One category" }] : []),
          { value: "products", label: "Choose products" },
        ]}
        onChange={(type) => {
          if (type === "all") onChange({ type: "all" });
          else if (type === "category") onChange({ type: "category", category: categories[0] || "mobile" });
          else onChange({ type: "products", products: [] });
        }}
      />

      {value.type === "category" && (
        <Segmented
          value={value.category}
          options={categories.map((c) => ({ value: c, label: categoryLabel(c) }))}
          onChange={(category) => onChange({ type: "category", category })}
        />
      )}

      {value.type === "products" && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products..."
                className={`${INPUT} pl-9`}
              />
            </div>
            <button
              type="button"
              onClick={() => onChange({ type: "products", products: visible.map((p) => p.name) })}
              className="text-[11px] font-semibold text-indigo-300 hover:text-white whitespace-nowrap cursor-pointer"
            >
              Select shown
            </button>
            <button
              type="button"
              onClick={() => onChange({ type: "products", products: [] })}
              className="text-[11px] font-semibold text-slate-400 hover:text-white cursor-pointer"
            >
              Clear
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
            {visible.map((p) => (
              <label
                key={p.name}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-900 text-xs text-slate-300 cursor-pointer"
              >
                <input type="checkbox" checked={chosen.includes(p.name)} onChange={() => toggle(p.name)} />
                <span className="truncate">{p.name}</span>
                {p.category && <span className="ml-auto text-[10px] text-slate-500">{categoryLabel(p.category)}</span>}
              </label>
            ))}
            {visible.length === 0 && <p className="text-[11px] text-slate-500 px-2 py-2">No products found.</p>}
          </div>

          <p className="text-[11px] text-slate-500">{chosen.length} selected</p>
        </div>
      )}
    </div>
  );
}

export interface ChangeSettings {
  mode: BulkMode;
  value: string;
  round: RoundTo;
}

export const DEFAULT_CHANGE: ChangeSettings = { mode: "percent_off", value: "10", round: 0 };

const QUICK_PERCENTS = [5, 10, 15, 20, 25, 30, 40, 50];

/** "How much?"  Decrease/Increase  %/₹  +  amount  +  rounding. */
export function ChangeFields({
  value,
  onChange,
}: {
  value: ChangeSettings;
  onChange: (next: ChangeSettings) => void;
}) {
  const isPercent = value.mode === "percent_off" || value.mode === "percent_up";

  return (
    <div className="space-y-2.5">
      <Segmented<BulkMode>
        value={value.mode}
        options={[
          { value: "percent_off", label: "Decrease %" },
          { value: "percent_up", label: "Increase %" },
          { value: "flat_off", label: "Decrease ₹" },
          { value: "flat_up", label: "Increase ₹" },
        ]}
        onChange={(mode) => onChange({ ...value, mode })}
      />

      <div className="flex items-center gap-2">
        <input
          value={value.value}
          onChange={(e) => onChange({ ...value, value: e.target.value.replace(/[^\d.]/g, "") })}
          inputMode="decimal"
          placeholder={isPercent ? "e.g. 10" : "e.g. 50"}
          className={`${INPUT} max-w-[140px] text-sm font-bold`}
        />
        <span className="text-xs text-slate-400 font-semibold">{isPercent ? "%" : "₹"}</span>
      </div>

      {isPercent && (
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PERCENTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange({ ...value, value: String(p) })}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border cursor-pointer ${
                value.value === String(p)
                  ? "bg-indigo-600/30 border-indigo-500 text-indigo-200"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {p}%
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-500">Round to</span>
        <Segmented<string>
          value={String(value.round)}
          options={[
            { value: "0", label: "Exact" },
            { value: "5", label: "₹5" },
            { value: "10", label: "₹10" },
          ]}
          onChange={(r) => onChange({ ...value, round: Number(r) as RoundTo })}
        />
      </div>
    </div>
  );
}

export async function adminCall(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || "Request failed.");
  }
  return data;
}

export async function loadPriceBookRows(): Promise<
  { product_name: string; category: string; duration: string; retail: number; reseller: number | null }[]
> {
  const data = await adminCall("/api/admin/price-book");
  return Array.isArray(data.rows) ? data.rows : [];
}

export function toProductOptions(
  rows: { product_name: string; category: string }[]
): ProductOption[] {
  const map = new Map<string, string>();
  for (const r of rows) if (!map.has(r.product_name)) map.set(r.product_name, r.category);
  return Array.from(map, ([name, category]) => ({ name, category })).sort((a, b) => a.name.localeCompare(b.name));
}
