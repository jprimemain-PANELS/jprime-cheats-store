"use client";

import { useEffect, useState } from "react";

type VipMap = Record<string, number>;

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; promise: Promise<VipMap> }>();

// One request per reseller, shared by every ProductCard on the page.
function loadVipPrices(username: string): Promise<VipMap> {
  const hit = cache.get(username);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;

  const promise = fetch("/api/my-reseller-prices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
    cache: "no-store",
  })
    .then((res) => res.json())
    .then((json) => {
      const map: VipMap = {};
      for (const row of Array.isArray(json?.prices) ? json.prices : []) {
        const price = Number(row?.reseller_price);
        if (row?.product_name && row?.duration && Number.isFinite(price)) {
          map[`${row.product_name}::${row.duration}`] = price;
        }
      }
      return map;
    })
    .catch(() => ({} as VipMap));

  cache.set(username, { at: Date.now(), promise });
  return promise;
}

// Returns { "Product Name::duration": customResellerPrice } for the logged-in
// reseller. Anyone else gets an empty object.
export function useVipPrices(): VipMap {
  const [prices, setPrices] = useState<VipMap>({});

  useEffect(() => {
    let cancelled = false;

    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const username = String(user?.username || "").trim();

      if (!username || user?.role !== "reseller") return;

      loadVipPrices(username).then((map) => {
        if (!cancelled) setPrices(map);
      });
    } catch {
      // ignore: falls back to the common reseller price
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return prices;
}