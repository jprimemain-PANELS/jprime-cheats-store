"use client";

import { useEffect, useState } from "react";
import { sanitizeRules, type DiscountRule } from "@/lib/discounts";

/**
 * Discounts that are running right now (public list from /api/discounts).
 * One shared request for every product card on the page, refreshed at most every 30 seconds.
 * This is DISPLAY only; the amount charged is decided again on the server at purchase time.
 */

const TTL_MS = 30_000;
let cache: { at: number; rules: DiscountRule[] } | null = null;
let inflight: Promise<DiscountRule[]> | null = null;

async function fetchRules(): Promise<DiscountRule[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rules;
  if (inflight) return inflight;

  inflight = fetch("/api/discounts", { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : { rules: [] }))
    .then((json) => {
      const rules = sanitizeRules(json?.rules);
      cache = { at: Date.now(), rules };
      return rules;
    })
    .catch(() => [] as DiscountRule[])
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function useDiscounts(): DiscountRule[] {
  const [rules, setRules] = useState<DiscountRule[]>(cache?.rules ?? []);

  useEffect(() => {
    let cancelled = false;
    fetchRules().then((list) => {
      if (!cancelled) setRules(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return rules;
}

/** Re-renders every `ms` so "ends in 1d 10h" stays correct without a reload. */
export function useNow(ms = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(timer);
  }, [ms]);

  return now;
}

/** "1d 10h", "3h 20m", "12m". Empty string when there is no end or it already passed. */
export function formatTimeLeft(endsAt: string | null, now: Date): string {
  if (!endsAt) return "";
  const ms = new Date(endsAt).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "";

  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${Math.max(1, mins)}m`;
}
