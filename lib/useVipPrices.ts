"use client";

import { useEffect, useState } from "react";

type VipMap = Record<string, number>;

const TTL_MS = 30_000;
let cached: { at: number; promise: Promise<VipMap> } | null = null;

// One request shared by every ProductCard on the page. The server identifies
// the reseller from the session cookie - no username is ever sent.
function loadVipPrices(): Promise<VipMap> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.promise;

  const promise = fetch("/api/my-reseller-prices", {
    method: "GET",
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

  cached = { at: Date.now(), promise };
  return promise;
}

// Returns { "Product Name::duration": customResellerPrice } for the
// logged-in reseller. Pass `enabled=false` for non-resellers (no request made).
export function useVipPrices(enabled: boolean = true): VipMap {
  const [prices, setPrices] = useState<VipMap>({});

  useEffect(() => {
    if (!enabled) {
      setPrices({});
      return;
    }

    let cancelled = false;
    loadVipPrices().then((map) => {
      if (!cancelled) setPrices(map);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return prices;
}
