"use client";

import { useEffect, useState } from "react";

type VipMap = Record<string, number>;
type VipPriceState = {
  identity: string;
  enabled: boolean;
  loaded: boolean;
  prices: VipMap;
};

const TTL_MS = 30_000;
let cached: { identity: string; at: number; promise: Promise<VipMap> } | null = null;

// One request is shared by all ProductCards for the same signed-in account.
// The identity key prevents one reseller's cached VIP prices being reused for
// another account after a login switch.
function loadVipPrices(identity: string): Promise<VipMap> {
  if (
    cached &&
    cached.identity === identity &&
    Date.now() - cached.at < TTL_MS
  ) {
    return cached.promise;
  }

  const promise = fetch("/api/my-reseller-prices", {
    method: "GET",
    cache: "no-store",
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`VIP price lookup failed (${res.status})`);
      return res.json();
    })
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
    .catch((error) => {
      // Fail closed on the visual tier: the card waits for this request before
      // showing any reseller price, then safely falls back to the common tier.
      console.error("Could not load VIP reseller prices:", error);
      return {} as VipMap;
    });

  cached = { identity, at: Date.now(), promise };
  return promise;
}

// Returns custom prices and a readiness flag. A reseller card must not reveal
// the common reseller tier until their personal VIP override lookup has finished.
export function useVipPrices(
  enabled: boolean = true,
  identity: string = "default"
): { prices: VipMap; loaded: boolean } {
  const [state, setState] = useState<VipPriceState>({
    identity: "",
    enabled: false,
    loaded: false,
    prices: {},
  });

  useEffect(() => {
    if (!enabled) {
      setState({ identity, enabled: false, loaded: true, prices: {} });
      return;
    }

    let cancelled = false;
    setState({ identity, enabled: true, loaded: false, prices: {} });

    loadVipPrices(identity).then((prices) => {
      if (!cancelled) {
        setState({ identity, enabled: true, loaded: true, prices });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, identity]);

  const stateMatches = state.enabled && state.identity === identity;
  return {
    prices: enabled && stateMatches ? state.prices : {},
    loaded: !enabled || (stateMatches && state.loaded),
  };
}
