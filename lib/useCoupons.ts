"use client";

import { useEffect, useState } from "react";
import type { PublicCouponView } from "@/lib/coupons";

let cache: { at: number; view: PublicCouponView } | null = null;
let inflight: Promise<PublicCouponView> | null = null;
const TTL = 30_000;

async function fetchView(): Promise<PublicCouponView> {
  if (cache && Date.now() - cache.at < TTL) return cache.view;
  if (!inflight) {
    inflight = fetch("/api/coupons/public", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const view: PublicCouponView = { all: j?.all || [], products: j?.products || {} };
        cache = { at: Date.now(), view };
        return view;
      })
      .catch(() => ({ all: [], products: {} }) as PublicCouponView)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Public coupon percentages (one shared request for all product cards). */
export function useCoupons(): PublicCouponView {
  const [view, setView] = useState<PublicCouponView>(cache?.view ?? { all: [], products: {} });
  useEffect(() => {
    let alive = true;
    fetchView().then((v) => alive && setView(v));
    return () => {
      alive = false;
    };
  }, []);
  return view;
}
