"use client";

import { useEffect, useState } from "react";
import { Crown, Loader2, Save, Trash2, AlertTriangle, ChevronDown, Copy } from "lucide-react";

interface ResellerOption {
  username: string;
  email?: string;
}

interface CatalogTier {
  duration: string;
  priceINR?: string;
  resellerPrice?: string;
}

interface CatalogProduct {
  id: string;
  name: string;
  prices: CatalogTier[];
}

interface VipRow {
  product_name: string;
  duration: string;
  reseller_price: number;
}

async function adminRequest(path: string, options: RequestInit = {}) {
  // Authentication is the HttpOnly session cookie; the server re-checks the
  // admin role on every call. No identity is sent from the browser.
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || "Request failed.");
  }

  return data;
}

export default function VipPriceManager({ resellers }: { resellers: ResellerOption[] }) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [username, setUsername] = useState("");
  const [rows, setRows] = useState<VipRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  const [productName, setProductName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // "product" = the original one-product editor, "all" = every product + duration on one screen.
  const [mode, setMode] = useState<"product" | "all">("product");
  const [gridDrafts, setGridDrafts] = useState<Record<string, string>>({});
  const [gridFilter, setGridFilter] = useState("");
  const [copyFrom, setCopyFrom] = useState("");

  // Load the product catalog (admin route) once.
  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const result = await adminRequest("/api/admin/catalog");
        const list: CatalogProduct[] = (result.products || [])
          .map((row: any) => {
            const d = row?.data || {};
            return {
              id: String(d.id || row.product_id || ""),
              name: String(d.name || row.name || ""),
              prices: Array.isArray(d.prices)
                ? d.prices.map((t: any) => ({
                    duration: String(t?.duration || ""),
                    priceINR: String(t?.priceINR || ""),
                    resellerPrice: String(t?.resellerPrice || ""),
                  }))
                : [],
            } as CatalogProduct;
          })
          .filter((p: CatalogProduct) => p.name && p.prices.length > 0);

        if (!cancelled) setProducts(list);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load products.");
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load the selected reseller's saved custom prices.
  useEffect(() => {
    if (!username) {
      setRows([]);
      return;
    }

    let cancelled = false;

    async function loadRows() {
      setLoadingRows(true);
      setError(null);
      setNotice(null);

      try {
        const result = await adminRequest(
          `/api/admin/reseller-prices?username=${encodeURIComponent(username)}`
        );
        if (!cancelled) setRows(result.prices || []);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load custom prices.");
      } finally {
        if (!cancelled) setLoadingRows(false);
      }
    }

    loadRows();

    return () => {
      cancelled = true;
    };
  }, [username]);

  // Rebuild the input boxes whenever the product or saved rows change.
  useEffect(() => {
    const product = products.find((p) => p.name === productName);
    if (!product) {
      setDrafts({});
      return;
    }

    const next: Record<string, string> = {};
    product.prices.forEach((tier) => {
      const existing = rows.find(
        (r) => r.product_name === product.name && r.duration === tier.duration
      );
      next[tier.duration] = existing ? String(existing.reseller_price) : "";
    });
    setDrafts(next);
  }, [productName, rows, products]);

  const selectedProduct = products.find((p) => p.name === productName) || null;

  const keyOf = (name: string, duration: string) => `${name}::${duration}`;

  const savedPrice = (name: string, duration: string): string => {
    const found = rows.find((r) => r.product_name === name && r.duration === duration);
    return found ? String(found.reseller_price) : "";
  };

  // Rebuild the all-products boxes from what is saved for this reseller.
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const p of products) {
      for (const t of p.prices) next[keyOf(p.name, t.duration)] = savedPrice(p.name, t.duration);
    }
    setGridDrafts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, products]);

  const changedKeys = Object.keys(gridDrafts).filter((k) => {
    const [name, ...rest] = k.split("::");
    return (gridDrafts[k] ?? "").trim() !== savedPrice(name, rest.join("::"));
  });

  const gridProducts = products.filter((p) =>
    gridFilter.trim() ? p.name.toLowerCase().includes(gridFilter.trim().toLowerCase()) : true
  );

  async function handleSaveAll() {
    if (!username) return;

    const prices: VipRow[] = [];
    const remove: { product_name: string; duration: string }[] = [];

    for (const p of products) {
      for (const tier of p.prices) {
        const k = keyOf(p.name, tier.duration);
        const raw = (gridDrafts[k] ?? "").trim();
        const before = savedPrice(p.name, tier.duration);
        if (raw === before) continue;

        if (raw === "") {
          remove.push({ product_name: p.name, duration: tier.duration });
          continue;
        }

        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0) {
          setError(`Invalid price for "${p.name}" / "${tier.duration}".`);
          return;
        }
        prices.push({ product_name: p.name, duration: tier.duration, reseller_price: Math.round(value) });
      }
    }

    if (prices.length === 0 && remove.length === 0) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const result = await adminRequest("/api/admin/reseller-prices", {
        method: "POST",
        body: JSON.stringify({ username, prices, remove }),
      });
      setRows(result.prices || []);
      setNotice(`Saved ${prices.length + remove.length} change(s) for @${username}.`);
    } catch (err: any) {
      setError(err?.message || "Failed to save custom prices.");
    } finally {
      setSaving(false);
    }
  }

  // Copy every custom price of one reseller to another (new resellers start from a good price list).
  async function handleCopy(replaceAll: boolean) {
    if (!username || !copyFrom || copyFrom === username) return;

    const message = replaceAll
      ? `Replace ALL of @${username}'s custom prices with @${copyFrom}'s prices?`
      : `Copy @${copyFrom}'s prices to @${username}? (Same product + duration are overwritten, other prices stay.)`;
    if (!confirm(message)) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const source = await adminRequest(`/api/admin/reseller-prices?username=${encodeURIComponent(copyFrom)}`);
      const sourceRows: VipRow[] = source.prices || [];

      if (sourceRows.length === 0) {
        setError(`@${copyFrom} has no custom prices to copy.`);
        return;
      }

      const sourceKeys = new Set(sourceRows.map((r) => keyOf(r.product_name, r.duration)));
      const remove = replaceAll
        ? rows
            .filter((r) => !sourceKeys.has(keyOf(r.product_name, r.duration)))
            .map((r) => ({ product_name: r.product_name, duration: r.duration }))
        : [];

      const result = await adminRequest("/api/admin/reseller-prices", {
        method: "POST",
        body: JSON.stringify({
          username,
          prices: sourceRows.map((r) => ({
            product_name: r.product_name,
            duration: r.duration,
            reseller_price: r.reseller_price,
          })),
          remove,
        }),
      });

      setRows(result.prices || []);
      setNotice(`Copied ${sourceRows.length} price(s) from @${copyFrom} to @${username}.`);
    } catch (err: any) {
      setError(err?.message || "Failed to copy prices.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!username || !selectedProduct) return;

    const prices: VipRow[] = [];
    const remove: { product_name: string; duration: string }[] = [];

    for (const tier of selectedProduct.prices) {
      const raw = (drafts[tier.duration] || "").trim();
      const existing = rows.find(
        (r) => r.product_name === selectedProduct.name && r.duration === tier.duration
      );

      if (raw === "") {
        if (existing) {
          remove.push({ product_name: selectedProduct.name, duration: tier.duration });
        }
        continue;
      }

      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        setError(`Invalid price for "${tier.duration}".`);
        return;
      }

      prices.push({
        product_name: selectedProduct.name,
        duration: tier.duration,
        reseller_price: Math.round(value),
      });
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const result = await adminRequest("/api/admin/reseller-prices", {
        method: "POST",
        body: JSON.stringify({ username, prices, remove }),
      });

      setRows(result.prices || []);
      setNotice(`Saved custom prices for @${username}.`);
    } catch (err: any) {
      setError(err?.message || "Failed to save custom prices.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveRow(row: VipRow) {
    if (!username) return;
    if (!confirm(`Remove the custom price for ${row.product_name} (${row.duration})?`)) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const result = await adminRequest("/api/admin/reseller-prices", {
        method: "POST",
        body: JSON.stringify({
          username,
          prices: [],
          remove: [{ product_name: row.product_name, duration: row.duration }],
        }),
      });

      setRows(result.prices || []);
      setNotice("Custom price removed. This reseller now pays the common reseller price.");
    } catch (err: any) {
      setError(err?.message || "Failed to remove custom price.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT: pick reseller + product */}
      <div className="lg:col-span-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <div className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
              <Crown className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-white tracking-wide">VIP Reseller</h2>
          </div>

          {resellers.length === 0 ? (
            <p className="text-xs text-slate-500 leading-relaxed">
              No users have the Reseller role yet. Set a user's role to Reseller in Users → Manage first.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 block">Select Reseller</label>
                <div className="relative">
                  <select
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setProductName("");
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-3.5 pr-9 text-xs text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Choose reseller…</option>
                    {resellers.map((r) => (
                      <option key={r.username} value={r.username}>
                        @{r.username}
                        {r.email ? ` — ${r.email}` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 block">Select Product</label>
                <div className="relative">
                  <select
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    disabled={!username || loadingCatalog}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-3.5 pr-9 text-xs text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all appearance-none cursor-pointer disabled:bg-slate-950/40 disabled:text-slate-600 disabled:cursor-not-allowed"
                  >
                    <option value="">{loadingCatalog ? "Loading products…" : "Choose product…"}</option>
                    {products.map((p) => (
                      <option key={p.id || p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                A custom price applies only to the selected reseller. Leave a box empty to use the common reseller price.
              </p>

              {username && resellers.length > 1 && (
                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Copy className="h-3.5 w-3.5" /> Copy prices from another reseller
                  </label>
                  <div className="relative">
                    <select
                      value={copyFrom}
                      onChange={(e) => setCopyFrom(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-3.5 pr-9 text-xs text-slate-100 outline-none focus:border-amber-500 appearance-none cursor-pointer"
                    >
                      <option value="">Copy from…</option>
                      {resellers
                        .filter((r) => r.username !== username)
                        .map((r) => (
                          <option key={r.username} value={r.username}>
                            @{r.username}
                          </option>
                        ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleCopy(false)}
                      disabled={!copyFrom || saving}
                      className="text-[11px] font-semibold bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white py-2 rounded-lg cursor-pointer"
                    >
                      Copy prices
                    </button>
                    <button
                      onClick={() => handleCopy(true)}
                      disabled={!copyFrom || saving}
                      className="text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 py-2 rounded-lg cursor-pointer"
                    >
                      Replace all
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* RIGHT: edit prices */}
      <div className="lg:col-span-8 space-y-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-3 flex-wrap">
            <h2 className="text-sm font-bold text-white tracking-wide">
              {mode === "all" && username
                ? `Custom Prices — @${username} — all products`
                : selectedProduct && username
                ? `Custom Prices — @${username} — ${selectedProduct.name}`
                : "Custom Prices"}
            </h2>

            <div className="flex items-center gap-2">
              {(["product", "all"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                    mode === m
                      ? "bg-amber-600 border-amber-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {m === "product" ? "One product" : "All products"}
                </button>
              ))}
            </div>

            {mode === "all" && username && (
              <button
                onClick={handleSaveAll}
                disabled={saving || changedKeys.length === 0}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save {changedKeys.length > 0 ? `${changedKeys.length} change${changedKeys.length === 1 ? "" : "s"}` : "changes"}
              </button>
            )}

            {mode === "product" && selectedProduct && username && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Changes
              </button>
            )}
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

          {!username ? (
            <p className="text-xs text-slate-500 py-8 text-center">Select a reseller to manage their custom prices.</p>
          ) : mode === "all" ? (
            <div className="space-y-4">
              <input
                value={gridFilter}
                onChange={(e) => setGridFilter(e.target.value)}
                placeholder="Search product…"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-100 outline-none focus:border-amber-500"
              />
              <div className="space-y-5 max-h-[560px] overflow-y-auto pr-1">
                {gridProducts.map((p) => (
                  <div key={p.id || p.name} className="space-y-2">
                    <p className="text-xs font-bold text-white">{p.name}</p>
                    {p.prices.map((tier) => {
                      const k = keyOf(p.name, tier.duration);
                      const dirty = (gridDrafts[k] ?? "").trim() !== savedPrice(p.name, tier.duration);
                      return (
                        <div
                          key={k}
                          className={`grid grid-cols-[1fr_100px_110px] gap-3 items-center rounded-lg border px-3 py-2 ${
                            dirty ? "border-amber-500/50 bg-amber-500/5" : "border-slate-800 bg-slate-950/50"
                          }`}
                        >
                          <span className="text-xs font-medium text-slate-300 min-w-0 truncate">{tier.duration}</span>
                          <span className="text-xs text-slate-500 text-right tabular-nums">
                            {tier.resellerPrice ? `₹${tier.resellerPrice}` : "—"}
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            placeholder="common"
                            value={gridDrafts[k] ?? ""}
                            onChange={(e) => setGridDrafts((prev) => ({ ...prev, [k]: e.target.value }))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2 text-xs text-slate-100 text-right outline-none focus:border-amber-500 placeholder-slate-600"
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
                {gridProducts.length === 0 && <p className="text-xs text-slate-500 py-6 text-center">No products found.</p>}
              </div>
            </div>
          ) : !selectedProduct ? (
            <p className="text-xs text-slate-500 py-8 text-center">Select a product to set this reseller's prices.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_120px_120px] gap-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <span>Duration</span>
                <span className="text-right">Common ₹</span>
                <span className="text-right">VIP ₹</span>
              </div>

              {selectedProduct.prices.map((tier) => (
                <div
                  key={tier.duration}
                  className="grid grid-cols-[1fr_120px_120px] gap-3 items-center bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2.5"
                >
                  <span className="text-xs font-medium text-slate-300 min-w-0 truncate">{tier.duration}</span>
                  <span className="text-xs text-slate-500 text-right tabular-nums">
                    {tier.resellerPrice ? `₹${tier.resellerPrice}` : "—"}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="common"
                    value={drafts[tier.duration] ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [tier.duration]: e.target.value }))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2 text-xs text-slate-100 text-right outline-none focus:border-amber-500 placeholder-slate-600"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {username && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-3">
            <h2 className="text-sm font-bold text-white tracking-wide">
              All custom prices for @{username} ({rows.length})
            </h2>

            {loadingRows ? (
              <p className="text-xs text-slate-500 py-4 text-center">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No custom prices. This reseller pays the common reseller price everywhere.
              </p>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {rows.map((row) => (
                  <div
                    key={`${row.product_name}::${row.duration}`}
                    className="flex items-center justify-between gap-3 bg-slate-950/50 border border-slate-800 rounded-lg px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{row.product_name}</p>
                      <p className="text-[11px] text-slate-500">{row.duration}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-bold text-amber-400 tabular-nums">₹{row.reseller_price}</span>
                      <button
                        onClick={() => handleRemoveRow(row)}
                        disabled={saving}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}