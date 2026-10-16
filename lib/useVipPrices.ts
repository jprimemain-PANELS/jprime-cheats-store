
"use client";

import { useEffect, useState } from "react";

type VipMap = Record<string, number>;

export function useVipPrices(enabled: boolean = true): VipMap {
  const [prices, setPrices] = useState<VipMap>({});

  useEffect(() => {
    if (!enabled) {
      setPrices({});
      return;
    }

    let cancelled = false;

    setPrices({});

    async function loadVipPrices() {
      try {
        const res = await fetch("/api/my-reseller-prices", {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Could not load reseller prices");
        }

        const json = await res.json();
        const map: VipMap = {};

        for (const row of Array.isArray(json?.prices) ? json.prices : []) {
          const price = Number(row?.reseller_price);

          if (
            row?.product_name &&
            row?.duration &&
            row?.reseller_price != null &&
            Number.isFinite(price)
          ) {
            map[`${row.product_name}::${row.duration}`] = price;
          }
        }

        if (!cancelled) {
          setPrices(map);
        }
      } catch {
        if (!cancelled) {
          setPrices({});
        }
      }
    }

    loadVipPrices();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return prices;
}
