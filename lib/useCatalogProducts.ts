"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/products";

export type CatalogSource = "catalog" | "fallback";

// Loads customer-safe products from /api/catalog. The server falls back to the
// built-in lib/products.ts list (with all supplier fields removed) when the
// catalog is empty or unavailable, so the storefront never goes blank and
// supplier IDs never reach the browser bundle.
export function useCatalogProducts(): {
  products: Product[];
  loading: boolean;
  source: CatalogSource;
} {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<CatalogSource>("fallback");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/catalog", { cache: "no-store" });
        if (!res.ok) throw new Error(`Catalog request failed (${res.status})`);

        const json = await res.json();
        const list: Product[] = Array.isArray(json?.products) ? json.products : [];

        if (cancelled) return;

        setProducts(list);
        setSource(json?.source === "catalog" ? "catalog" : "fallback");
      } catch (err) {
        console.error("Catalog load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const refreshCatalog = () => { void load(); };
    void load();
    window.addEventListener("jprime-catalog-updated", refreshCatalog);

    return () => {
      cancelled = true;
      window.removeEventListener("jprime-catalog-updated", refreshCatalog);
    };
  }, []);

  return { products, loading, source };
}
