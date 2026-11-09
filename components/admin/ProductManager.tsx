"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Save,
  Trash2,
  X,
  RefreshCw,
  Upload,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  deliveryModeForTier,
  hasSeller1Config,
  hasSeller2Config,
  normalizeStockText,
  normalizeSupplier,
  summarizeFulfillment,
} from "@/lib/delivery";
import {
  legacyToCatalogProduct,
  normalizeProduct,
  routingProblems,
  type CatalogProduct as Product,
  type CatalogTier as PriceTier,
} from "@/lib/catalog-edit";


const emptyProduct: Product = {
  id: "",
  name: "",
  category: "mobile",
  fulfillmentType: "API",
  updateChannel: "",
  features: [""],
  videoPlaceholder: "",
  videoUrl: "",
  status: "ONLINE",
  prices: [
    {
      duration: "1 day",
      priceINR: "",
      resellerPrice: "",
      supplier: "",
      seller1Pid: "",
      seller1Duration: "",
      seller2VariantId: "",
    },
  ],
};

async function adminCatalogRequest(
  path: string,
  options: RequestInit = {}
) {
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
    throw new Error(data?.error || "Catalog request failed.");
  }

  return data;
}

export default function ProductManager({ isOwner = true }: { isOwner?: boolean } = {}) {
  // Built-in product list, from an admin-only endpoint (used by "Import Existing").
  const [allProducts, setAllProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!isOwner) return; // the built-in list belongs to the owner store only
    adminCatalogRequest("/api/admin/legacy-products")
      .then((r) => setAllProducts(Array.isArray(r.products) ? r.products : []))
      .catch(() => setAllProducts([]));
  }, [isOwner]);

  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const [showEditor, setShowEditor] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);

    try {
      const [catalogResult, adminResult] = await Promise.all([
        adminCatalogRequest("/api/admin/catalog"),
        adminCatalogRequest("/api/admin/data"),
      ]);
      const rows = catalogResult.products || [];
      const priceRows: any[] = Array.isArray(adminResult.priceRows) ? adminResult.priceRows : [];
      const pricesByKey = new Map<string, { priceINR: number; resellerPrice: number | null }>();
      const statusesByName = new Map<string, "ONLINE" | "MAINTENANCE">();

      for (const row of priceRows) {
        if (row.duration === "__status__") {
          statusesByName.set(row.product_name, Number(row.price_inr) === 1 ? "MAINTENANCE" : "ONLINE");
        } else {
          pricesByKey.set(`${row.product_name}::${row.duration}`, {
            priceINR: Number(row.price_inr),
            resellerPrice: row.reseller_price == null ? null : Number(row.reseller_price),
          });
        }
      }

      const mergedProducts = rows.map((row: any) => {
        const product = normalizeProduct({
          ...(row.data || {}),
          id: row.data?.id || row.product_id,
          name: row.data?.name || row.name,
        });
        return {
          ...product,
          status: statusesByName.get(product.name) ?? product.status,
          prices: product.prices.map((tier: any) => {
            const override = pricesByKey.get(`${product.name}::${tier.duration}`);
            if (!override || !Number.isFinite(override.priceINR)) return tier;
            return {
              ...tier,
              priceINR: String(override.priceINR),
              resellerPrice: override.resellerPrice == null ? "" : String(override.resellerPrice),
            };
          }),
        } as Product;
      });

      setProducts(mergedProducts);
    } catch (error: any) {
      console.error(error);
      alert("Failed to load products: " + (error?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }

  function newProduct() {
    setSelected({
      ...emptyProduct,
      id: `product-${Date.now()}`,
      prices: [
        {
          duration: "1 day",
          priceINR: "",
          resellerPrice: "",
          supplier: "",
          seller1Pid: "",
          seller1Duration: "",
          seller2VariantId: "",
        },
      ],
    });

    setShowEditor(true);
  }

  function editProduct(product: Product) {
    setSelected(
      JSON.parse(JSON.stringify(product))
    );

    setShowEditor(true);
  }

  async function saveProduct() {
    if (!selected) return;

    if (!selected.id.trim()) {
      alert("Product ID is required.");
      return;
    }

    if (!selected.name.trim()) {
      alert("Product name is required.");
      return;
    }

    if (!selected.prices.length) {
      alert("Add at least one duration.");
      return;
    }

    // Every duration needs an explicit supplier. Nothing is ever defaulted to LOCAL.
    const problems = routingProblems(selected);
    const blocking = problems.filter((p) => p.includes("no supplier chosen"));

    if (blocking.length) {
      alert("Choose a supplier for every duration before saving:\n\n" + blocking.join("\n"));
      return;
    }

    if (problems.length) {
      const goOn = window.confirm(
        "Please check these supplier settings:\n\n" + problems.join("\n") + "\n\nSave anyway?"
      );
      if (!goOn) return;
    }

    const cleaned: Product = {
      ...selected,

      id: selected.id.trim(),
      name: selected.name.trim(),

      features: selected.features
        .map((x) => x.trim())
        .filter(Boolean),

      prices: selected.prices
        .filter((x) => x.duration.trim())
        .map((x) => ({
          ...x,
          duration: x.duration.trim(),
          priceINR: String(x.priceINR || "").trim(),
          resellerPrice: String(x.resellerPrice || "").trim(),
          priceUSD: String(x.priceUSD || "").trim(),

          supplier: normalizeSupplier(x.supplier) ?? "",

          seller1Pid: String(x.seller1Pid || "").trim(),
          seller1Duration: String(
            x.seller1Duration || ""
          ).trim(),

          seller2VariantId: String(
            x.seller2VariantId || ""
          ).trim(),
        })),
    };

    // Product-level flag is only a summary of the durations (kept for older code).
    cleaned.fulfillmentType = summarizeFulfillment(
      cleaned.prices.map((t) => deliveryModeForTier(t, undefined))
    );

    setSaving(true);

    try {
      await adminCatalogRequest("/api/admin/catalog", {
        method: "POST",
        body: JSON.stringify({
          product: cleaned,
        }),
      });
    } catch (error: any) {
      console.error(error);
      alert("Save failed: " + (error?.message || "Unknown error"));
      setSaving(false);
      return;
    }
    
    setSaving(false);

    /*
     * Keep the existing product_prices table working.
     * This means your current storefront price override
     * system continues to work.
     */
    const priceRows = cleaned.prices
      .map((tier: any) => {
        const price = Number(String(tier.priceINR).replace(/[^0-9.]/g, ""));
        const reseller = tier.resellerPrice
          ? Number(String(tier.resellerPrice).replace(/[^0-9.]/g, ""))
          : null;

        return {
          product_name: cleaned.name,
          duration: tier.duration,
          price_inr: price,
          reseller_price: reseller !== null && Number.isNaN(reseller) ? null : reseller,
        };
      })
      .filter((r: any) => !Number.isNaN(r.price) && r.price > 0);

    if (priceRows.length > 0) {
      try {
        await adminCatalogRequest("/api/admin/data", {
          method: "POST",
          body: JSON.stringify({ action: "save_prices", rows: priceRows }),
        });
      } catch (error: any) {
        console.error(error);
        alert("Product saved, but price sync failed: " + (error?.message || "Unknown error"));
      }
    }

    try {
      await adminCatalogRequest("/api/admin/data", {
        method: "POST",
        body: JSON.stringify({ action: "set_status", product_name: cleaned.name, status: cleaned.status }),
      });
    } catch (error: any) {
      console.error(error);
      alert("Product saved, but status sync failed: " + (error?.message || "Unknown error"));
    }

    window.dispatchEvent(new Event("jprime-catalog-updated"));
    alert("Product saved successfully.");

    setShowEditor(false);
    setSelected(null);

    await loadProducts();
  }

 async function deleteProduct(product: Product) {
  const confirmed = window.confirm(
    `Delete "${product.name}" from Product Catalog?\n\nThis does NOT delete old stock keys or purchase history.`
  );

  if (!confirmed) return;

  try {
    await adminCatalogRequest("/api/admin/catalog", {
      method: "DELETE",
      body: JSON.stringify({
        product_id: product.id,
      }),
    });

    if (selected?.id === product.id) {
      setSelected(null);
      setShowEditor(false);
    }

    window.dispatchEvent(new Event("jprime-catalog-updated"));
    await loadProducts();
  } catch (error: any) {
    alert("Delete failed: " + (error?.message || "Unknown error"));
  }
}

  async function importExistingProducts() {
    if (!allProducts?.length) {
      alert("No existing products found in lib/products.ts");
      return;
    }

    setImporting(true);

    try {
      // Read the LIVE catalogue first so nothing that already exists is ever overwritten.
      const live = await adminCatalogRequest("/api/admin/catalog");
      const liveRows: any[] = Array.isArray(live.products) ? live.products : [];

      const existingIds = new Set(
        liveRows.map((r) => String(r?.product_id ?? r?.data?.id ?? "").trim().toLowerCase())
      );
      const existingNames = new Set(
        liveRows.map((r) => normalizeStockText(r?.name ?? r?.data?.name))
      );

      const toImport = allProducts.filter(
        (p: any) =>
          !existingIds.has(String(p.id ?? "").trim().toLowerCase()) &&
          !existingNames.has(normalizeStockText(p.name))
      );
      const skipped = allProducts.length - toImport.length;

      if (toImport.length === 0) {
        setImporting(false);
        alert(
          `Nothing to import. All ${allProducts.length} built-in products already exist in your catalogue and were left untouched.`
        );
        return;
      }

      const confirmed = window.confirm(
        `Import ${toImport.length} built-in product(s) that are not in your catalogue yet?\n\n` +
          `${skipped} product(s) already in the catalogue will NOT be changed.\n` +
          `Supplier is detected from each product's real configuration.`
      );

      if (!confirmed) {
        setImporting(false);
        return;
      }

      const notes: string[] = [];

      for (const legacy of toImport) {
        const converted = legacyToCatalogProduct(legacy, notes);
        await adminCatalogRequest("/api/admin/catalog", {
          method: "POST",
          body: JSON.stringify({ product: converted }),
        });
      }

      setImporting(false);

      alert(
        `${toImport.length} product(s) imported. ${skipped} existing product(s) were left untouched.` +
          (notes.length ? `\n\nPlease review:\n\n${notes.slice(0, 15).join("\n")}` : "")
      );

      window.dispatchEvent(new Event("jprime-catalog-updated"));
      await loadProducts();
    } catch (error: any) {
      console.error(error);
      setImporting(false);
      alert("Import failed: " + (error?.message || "Unknown error"));
    }
  }

  function updateSelected(
    field: keyof Product,
    value: any
  ) {
    if (!selected) return;

    setSelected({
      ...selected,
      [field]: value,
    });
  }

  function updateFeature(
    index: number,
    value: string
  ) {
    if (!selected) return;

    const features = [...selected.features];

    features[index] = value;

    setSelected({
      ...selected,
      features,
    });
  }

  function addFeature() {
    if (!selected) return;

    setSelected({
      ...selected,
      features: [
        ...selected.features,
        "",
      ],
    });
  }

  function removeFeature(index: number) {
    if (!selected) return;

    const features = selected.features.filter(
      (_, i) => i !== index
    );

    setSelected({
      ...selected,
      features:
        features.length ? features : [""],
    });
  }

  function updateTier(
    index: number,
    field: keyof PriceTier,
    value: any
  ) {
    if (!selected) return;

    const prices = [...selected.prices];

    prices[index] = {
      ...prices[index],
      [field]: value,
    };

    setSelected({
      ...selected,
      prices,
    });
  }

  function addDuration() {
    if (!selected) return;

    // Inherit the routing of the last duration (same product, same supplier is the usual case).
    // Seller IDs are NOT copied: each duration has its own, so they must be entered explicitly.
    const last = selected.prices[selected.prices.length - 1];
    const inheritedSupplier = normalizeSupplier(last?.supplier) ?? "";

    setSelected({
      ...selected,

      prices: [
        ...selected.prices,

        {
          duration: "",
          priceINR: "",
          resellerPrice: "",

          supplier: inheritedSupplier,

          // Seller 1 product id is the same for every duration of a product, so inherit it.
          seller1Pid:
            inheritedSupplier === "SELLER1" ? String(last?.seller1Pid || "") : "",
          seller1Duration: "",

          seller2VariantId: "",
        },
      ],
    });
  }

  function removeDuration(index: number) {
    if (!selected) return;

    if (selected.prices.length <= 1) {
      alert("A product must have at least one duration.");
      return;
    }

    setSelected({
      ...selected,

      prices: selected.prices.filter(
        (_, i) => i !== index
      ),
    });
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

        <div>
          <h2 className="text-2xl font-bold">
            Product Manager
          </h2>

          <p className="text-sm text-zinc-400 mt-1">
            Manage products, prices, durations and supplier routing.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">

          {isOwner && (
          <button
            onClick={importExistingProducts}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition"
          >
            <Upload className="w-4 h-4" />

            {importing
              ? "Importing..."
              : "Import Existing"}
          </button>
          )}

          <button
            onClick={loadProducts}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition"
          >
            <RefreshCw className="w-4 h-4" />

            Refresh
          </button>

          <button
            onClick={newProduct}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-black font-bold hover:bg-cyan-400 transition"
          >
            <Plus className="w-4 h-4" />

            Add Product
          </button>

        </div>
      </div>

      {/* PRODUCT LIST */}

      {loading ? (

        <div className="p-10 text-center text-zinc-400">
          Loading products...
        </div>

      ) : products.length === 0 ? (

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-10 text-center">

          <p className="text-zinc-400 mb-5">
            No products are in the new catalog yet.
          </p>

          {isOwner && (
          <button
            onClick={importExistingProducts}
            className="px-5 py-3 rounded-xl bg-cyan-500 text-black font-bold"
          >
            Import Existing Products
          </button>
          )}

        </div>

      ) : (

        <div className="grid gap-3">

          {products.map((product) => {

            const expanded =
              expandedProduct === product.id;

            return (
              <div
                key={product.id}
                className="border border-zinc-800 bg-zinc-950 rounded-2xl overflow-hidden"
              >

                <div className="p-4 flex items-center justify-between gap-4">

                  <button
                    onClick={() =>
                      setExpandedProduct(
                        expanded ? null : product.id
                      )
                    }
                    className="flex items-center gap-3 text-left flex-1 min-w-0"
                  >

                    {expanded ? (
                      <ChevronUp className="w-5 h-5 shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 shrink-0" />
                    )}

                    <div className="min-w-0">

                      <div className="font-semibold truncate">
                        {product.name}
                      </div>

                      <div className="text-xs text-zinc-500 mt-1">
                        {product.id} •{" "}
                        {product.category} •{" "}
                        {product.prices.length} duration
                        {product.prices.length !== 1
                          ? "s"
                          : ""}
                      </div>

                    </div>

                  </button>

                  <div className="flex items-center gap-2 shrink-0">

                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        product.status === "ONLINE"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-yellow-500/10 text-yellow-400"
                      }`}
                    >
                      {product.status}
                    </span>

                    <button
                      onClick={() =>
                        editProduct(product)
                      }
                      className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() =>
                        deleteProduct(product)
                      }
                      className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-zinc-800 p-4 space-y-3">

                    <div className="text-sm text-zinc-400">
                      <span className="text-white">
                        Features:
                      </span>{" "}
                      {product.features.join(", ") ||
                        "None"}
                    </div>

                    <div className="text-sm text-zinc-400">
                      <span className="text-white">
                        Video:
                      </span>{" "}
                      {product.videoUrl ||
                        "No video URL"}
                    </div>

                    {product.prices.map(
                      (tier, index) => (
                        <div
                          key={index}
                          className="rounded-xl bg-zinc-900 p-3"
                        >
                          <div className="font-medium">
                            {tier.duration}
                          </div>

                          <div className="text-xs text-zinc-500 mt-1">
                            ₹{tier.priceINR} • Reseller ₹
                            {tier.resellerPrice || "0"} •{" "}
                            {tier.supplier || "SUPPLIER NOT SET"}
                            {tier.supplier === "LOCAL" &&
                            (hasSeller1Config(tier) || hasSeller2Config(tier))
                              ? " ⚠ Seller IDs saved"
                              : ""}
                          </div>
                        </div>
                      )
                    )}

                  </div>
                )}

              </div>
            );
          })}

        </div>
      )}

      {/* EDITOR */}

      {showEditor && selected && (

        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm overflow-y-auto p-4">

          <div className="max-w-5xl mx-auto my-8 bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl">

            {/* EDITOR HEADER */}

            <div className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800 px-6 py-5 flex items-center justify-between">

              <div>
                <h3 className="text-xl font-bold">
                  {selected.name
                    ? "Edit Product"
                    : "Add Product"}
                </h3>

                <p className="text-xs text-zinc-500 mt-1">
                  Customer-facing design remains unchanged.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowEditor(false);
                  setSelected(null);
                }}
                className="p-2 rounded-xl hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            <div className="p-6 space-y-8">

              {/* BASIC DETAILS */}

              <section>

                <h4 className="font-bold text-lg mb-4">
                  Basic Details
                </h4>

                <div className="grid md:grid-cols-2 gap-4">

                  <div>
                    <label className="text-xs text-zinc-400">
                      Product ID
                    </label>

                    <input
                      value={selected.id}
                      onChange={(e) =>
                        updateSelected(
                          "id",
                          e.target.value
                        )
                      }
                      className="w-full mt-1 p-3 rounded-xl bg-zinc-900 border border-zinc-800 outline-none focus:border-cyan-500"
                      placeholder="example-product"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400">
                      Product Name
                    </label>

                    <input
                      value={selected.name}
                      onChange={(e) =>
                        updateSelected(
                          "name",
                          e.target.value
                        )
                      }
                      className="w-full mt-1 p-3 rounded-xl bg-zinc-900 border border-zinc-800 outline-none focus:border-cyan-500"
                      placeholder="Product name"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400">
                      Category
                    </label>

                    <select
                      value={selected.category}
                      onChange={(e) =>
                        updateSelected(
                          "category",
                          e.target.value
                        )
                      }
                      className="w-full mt-1 p-3 rounded-xl bg-zinc-900 border border-zinc-800"
                    >
                      <option value="mobile">
                        Mobile
                      </option>

                      <option value="pc">
                        PC
                      </option>

                      <option value="ios">
                        iOS
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400">
                      Delivery (from durations)
                    </label>

                    <div className="w-full mt-1 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-300">
                      {selected.prices.length === 0
                        ? "No durations yet"
                        : (() => {
                            const modes = selected.prices.map((t) =>
                              deliveryModeForTier(t, undefined)
                            );
                            const api = modes.filter((m) => m === "API").length;
                            if (api === modes.length) return "API (bb team admin / whitex seller hub)";
                            if (api === 0) return "LOCAL STOCK";
                            return "MIXED (set per duration below)";
                          })()}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400">
                      Status
                    </label>

                    <select
                      value={selected.status}
                      onChange={(e) =>
                        updateSelected(
                          "status",
                          e.target.value
                        )
                      }
                      className="w-full mt-1 p-3 rounded-xl bg-zinc-900 border border-zinc-800"
                    >
                      <option value="ONLINE">
                        ONLINE
                      </option>

                      <option value="MAINTENANCE">
                        MAINTENANCE
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400">
                      Update Channel
                    </label>

                    <input
                      value={
                        selected.updateChannel
                      }
                      onChange={(e) =>
                        updateSelected(
                          "updateChannel",
                          e.target.value
                        )
                      }
                      className="w-full mt-1 p-3 rounded-xl bg-zinc-900 border border-zinc-800"
                      placeholder="Telegram / WhatsApp / Discord"
                    />
                  </div>

                </div>

              </section>

              {/* VIDEO */}

              <section>

                <h4 className="font-bold text-lg mb-4">
                  Video
                </h4>

                <input
                  value={selected.videoUrl || ""}
                  onChange={(e) =>
                    updateSelected(
                      "videoUrl",
                      e.target.value
                    )
                  }
                  className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800"
                  placeholder="https://..."
                />

              </section>

              {/* FEATURES */}

              <section>

                <div className="flex items-center justify-between mb-4">

                  <h4 className="font-bold text-lg">
                    Features
                  </h4>

                  <button
                    onClick={addFeature}
                    className="text-sm px-3 py-2 rounded-lg bg-zinc-800"
                  >
                    + Add Feature
                  </button>

                </div>

                <div className="space-y-2">

                  {selected.features.map(
                    (feature, index) => (

                      <div
                        key={index}
                        className="flex gap-2"
                      >

                        <input
                          value={feature}
                          onChange={(e) =>
                            updateFeature(
                              index,
                              e.target.value
                            )
                          }
                          className="flex-1 p-3 rounded-xl bg-zinc-900 border border-zinc-800"
                          placeholder={`Feature ${
                            index + 1
                          }`}
                        />

                        <button
                          onClick={() =>
                            removeFeature(index)
                          }
                          className="p-3 rounded-xl bg-red-500/10 text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                      </div>

                    )
                  )}

                </div>

              </section>

              {/* DURATIONS */}

              <section>

                <div className="flex items-center justify-between mb-4">

                  <div>
                    <h4 className="font-bold text-lg">
                      Durations & Supplier Routing
                    </h4>

                    <p className="text-xs text-zinc-500 mt-1">
                      Supplier selection is internal only.
                    </p>
                  </div>

                  <button
                    onClick={addDuration}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500 text-black font-bold"
                  >
                    <Plus className="w-4 h-4" />
                    Add Duration
                  </button>

                </div>

                <div className="space-y-5">

                  {selected.prices.map(
                    (tier, index) => (

                      <div
                        key={index}
                        className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
                      >

                        <div className="flex items-center justify-between mb-4">

                          <h5 className="font-bold">
                            Duration #{index + 1}
                          </h5>

                          <button
                            onClick={() =>
                              removeDuration(index)
                            }
                            className="text-red-400 text-sm flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </button>

                        </div>

                        <div className="grid md:grid-cols-3 gap-4">

                          <div>
                            <label className="text-xs text-zinc-400">
                              Customer Duration
                            </label>

                            <input
                              value={tier.duration}
                              onChange={(e) =>
                                updateTier(
                                  index,
                                  "duration",
                                  e.target.value
                                )
                              }
                              className="w-full mt-1 p-3 rounded-xl bg-zinc-950 border border-zinc-800"
                              placeholder="1 day"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-zinc-400">
                              Customer Price ₹
                            </label>

                            <input
                              type="number"
                              value={tier.priceINR}
                              onChange={(e) =>
                                updateTier(
                                  index,
                                  "priceINR",
                                  e.target.value
                                )
                              }
                              className="w-full mt-1 p-3 rounded-xl bg-zinc-950 border border-zinc-800"
                              placeholder="40"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-zinc-400">
                              Reseller Price ₹
                            </label>

                            <input
                              type="number"
                              value={
                                tier.resellerPrice || ""
                              }
                              onChange={(e) =>
                                updateTier(
                                  index,
                                  "resellerPrice",
                                  e.target.value
                                )
                              }
                              className="w-full mt-1 p-3 rounded-xl bg-zinc-950 border border-zinc-800"
                              placeholder="28"
                            />
                          </div>

                        </div>

                        {/* SUPPLIER */}

                        <div className="mt-5">

                          <label className="text-xs text-zinc-400">
                            Internal Supplier
                          </label>

                          <select
                            value={tier.supplier || ""}
                            onChange={(e) =>
                              updateTier(
                                index,
                                "supplier",
                                e.target.value
                              )
                            }
                            className={`w-full mt-1 p-3 rounded-xl bg-zinc-950 border ${
                              tier.supplier
                                ? "border-zinc-800"
                                : "border-amber-500/60"
                            }`}
                          >
                            <option value="" disabled>
                              Select supplier...
                            </option>

                            <option value="LOCAL">
                              Local Stock
                            </option>

                            {isOwner ? (
                              <>
                                <option value="SELLER1">
                                  bb team admin
                                </option>

                                <option value="SELLER2">
                                  whitex seller hub
                                </option>
                              </>
                            ) : (
                              <option value="" disabled>
                                JPRIME API stock (coming soon)
                              </option>
                            )}
                          </select>

                        </div>

                        {/* SELLER 1 */}

                        {tier.supplier ===
                          "SELLER1" && (

                          <div className="mt-4 grid md:grid-cols-2 gap-4">

                            <div>
                              <label className="text-xs text-zinc-400">
                                bb team admin PID
                              </label>

                              <input
                                value={
                                  tier.seller1Pid ||
                                  ""
                                }
                                onChange={(e) =>
                                  updateTier(
                                    index,
                                    "seller1Pid",
                                    e.target.value
                                  )
                                }
                                className="w-full mt-1 p-3 rounded-xl bg-zinc-950 border border-zinc-800"
                                placeholder="62"
                              />
                            </div>

                            <div>
                              <label className="text-xs text-zinc-400">
                                bb team admin Duration
                              </label>

                              <input
                                value={
                                  tier.seller1Duration ||
                                  ""
                                }
                                onChange={(e) =>
                                  updateTier(
                                    index,
                                    "seller1Duration",
                                    e.target.value
                                  )
                                }
                                className="w-full mt-1 p-3 rounded-xl bg-zinc-950 border border-zinc-800"
                                placeholder="30 Days NONROOT"
                              />
                            </div>

                          </div>
                        )}

                        {/* SELLER 2 */}

                        {tier.supplier ===
                          "SELLER2" && (

                          <div className="mt-4">

                            <label className="text-xs text-zinc-400">
                              whitex seller hub Variant ID
                            </label>

                            <input
                              value={
                                tier.seller2VariantId ||
                                ""
                              }
                              onChange={(e) =>
                                updateTier(
                                  index,
                                  "seller2VariantId",
                                  e.target.value
                                )
                              }
                              className="w-full mt-1 p-3 rounded-xl bg-zinc-950 border border-zinc-800"
                              placeholder="167"
                            />

                          </div>
                        )}

                      </div>

                    )
                  )}

                </div>

              </section>

              {/* SAVE */}

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-zinc-800">

                <button
                  onClick={saveProduct}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 p-4 rounded-xl bg-cyan-500 text-black font-black hover:bg-cyan-400 disabled:opacity-50"
                >
                  <Save className="w-5 h-5" />

                  {saving
                    ? "Saving..."
                    : "Save Product"}
                </button>

                <button
                  onClick={() => {
                    setShowEditor(false);
                    setSelected(null);
                  }}
                  className="px-6 py-4 rounded-xl bg-zinc-800 hover:bg-zinc-700"
                >
                  Cancel
                </button>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}