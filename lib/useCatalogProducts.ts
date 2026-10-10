"use client";

import { useEffect, useState } from "react";
import { allProducts } from "@/lib/products";
import type { Product } from "@/lib/products";

export type CatalogSource = "catalog" | "fallback";

// Loads customer-safe products from /api/catalog (backed by products_catalog).
// If the catalog is empty or fails to load, falls back to allProducts
// from lib/products.ts so the storefront never goes blank.
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
      setLoading(true);
      try {
        const res = await fetch("/api/catalog", { cache: "no-store" });
        if (!res.ok) throw new Error(`Catalog request failed (${res.status})`);

        const json = await res.json();
        const list: Product[] = Array.isArray(json?.products) ? json.products : [];

        if (cancelled) return;

        if (list.length > 0) {
          setProducts(list);
          setSource("catalog");
        } else {
          setProducts(allProducts);
          setSource("fallback");
        }
      } catch (err) {
        console.error("Catalog load failed, using lib/products.ts:", err);
        if (cancelled) return;
        setProducts(allProducts);
        setSource("fallback");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const refreshCatalog = () => {
      void load();
    };

    void load();
    window.addEventListener("jprime-catalog-updated", refreshCatalog);

    return () => {
      cancelled = true;
      window.removeEventListener("jprime-catalog-updated", refreshCatalog);
    };
  }, []);

  return { products, loading, source };
}