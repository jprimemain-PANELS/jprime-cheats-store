import { OWNER_TENANT_ID, readSetting, writeSetting } from "@/lib/tenant-db";

/**
 * Editable subscription prices + free-trial days.
 * One config per "seller of plans": the OWNER store (stores that pay on the main website) or a co-admin store
 * whose own resellers launch sub-stores that pay that co-admin. Stored as one JSON value in app_settings under
 * that store's private key prefix. The server (never the browser) reads it when taking payment.
 */
export const PLAN_KEYS = ["weekly", "monthly", "quarterly"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export const DEFAULT_PLAN_PRICES: Record<PlanKey, number> = { weekly: 90, monthly: 249, quarterly: 695 };
export const PLAN_DAYS: Record<PlanKey, number> = { weekly: 7, monthly: 30, quarterly: 90 };
const LABELS: Record<PlanKey, string> = { weekly: "Weekly", monthly: "Monthly", quarterly: "3 Months" };
export const DEFAULT_TRIAL_DAYS = 3;
export const MAX_TRIAL_DAYS = 30;
const KEY = "sub_plans";

export type PlanConfig = { prices: Record<PlanKey, number>; trialDays: number };
export type PlanView = { label: string; price: number; days: number; note: string };

export const defaultPlanConfig = (): PlanConfig => ({ prices: { ...DEFAULT_PLAN_PRICES }, trialDays: DEFAULT_TRIAL_DAYS });

function cleanPrice(v: unknown): number | null {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 100000 ? n : null;
}

export function cleanPlanConfig(raw: any): PlanConfig {
  const d = defaultPlanConfig();
  const o = raw && typeof raw === "object" ? raw : {};
  const p = o.prices && typeof o.prices === "object" ? o.prices : {};
  const t = Math.round(Number(o.trialDays));
  return {
    prices: { weekly: cleanPrice(p.weekly) ?? d.prices.weekly, monthly: cleanPrice(p.monthly) ?? d.prices.monthly, quarterly: cleanPrice(p.quarterly) ?? d.prices.quarterly },
    trialDays: Number.isFinite(t) && t >= 1 && t <= MAX_TRIAL_DAYS ? t : d.trialDays,
  };
}

/** What the screens show. The "Save X%" note is worked out from the prices, so it is always true. */
export function planViews(cfg: PlanConfig): Record<PlanKey, PlanView> {
  const out = {} as Record<PlanKey, PlanView>;
  for (const k of PLAN_KEYS) out[k] = { label: LABELS[k], price: cfg.prices[k], days: PLAN_DAYS[k], note: "" };
  const full = (cfg.prices.monthly * PLAN_DAYS.quarterly) / PLAN_DAYS.monthly;
  const save = Math.round((1 - cfg.prices.quarterly / full) * 100);
  if (save >= 1) out.quarterly.note = `Save ${save}%`;
  return out;
}

const cache = new Map<string, { at: number; v: PlanConfig }>();
export const clearPlanCache = (id?: string) => { if (id) cache.delete(id); else cache.clear(); };

export async function getPlanConfig(sellerTenantId: string): Promise<PlanConfig> {
  const hit = process.env.VITEST ? undefined : cache.get(sellerTenantId);
  if (hit && Date.now() - hit.at < 60_000) return hit.v;
  try {
    const r = await readSetting(sellerTenantId, KEY);
    const v = cleanPlanConfig((r.data as any)?.value);
    if (!process.env.VITEST) cache.set(sellerTenantId, { at: Date.now(), v });
    return v;
  } catch {
    return defaultPlanConfig();
  }
}

export async function savePlanConfig(sellerTenantId: string, patch: any): Promise<{ ok: true; config: PlanConfig } | { ok: false; error: string }> {
  const cur = await getPlanConfig(sellerTenantId);
  const next: PlanConfig = { prices: { ...cur.prices }, trialDays: cur.trialDays };
  if (patch?.prices !== undefined) {
    for (const k of PLAN_KEYS) {
      if (patch.prices?.[k] === undefined) continue;
      const p = cleanPrice(patch.prices[k]);
      if (p === null) return { ok: false, error: `${LABELS[k]} price must be a whole number from ₹1 to ₹100000.` };
      next.prices[k] = p;
    }
  }
  if (patch?.trialDays !== undefined) {
    const t = Math.round(Number(patch.trialDays));
    if (!Number.isFinite(t) || t < 1 || t > MAX_TRIAL_DAYS) return { ok: false, error: `Free trial must be 1 to ${MAX_TRIAL_DAYS} days.` };
    next.trialDays = t;
  }
  const w = await writeSetting(sellerTenantId, KEY, next);
  clearPlanCache(sellerTenantId);
  if (w.error) return { ok: false, error: "Could not save. Make sure the app_settings table exists." };
  return { ok: true, config: next };
}

export { OWNER_TENANT_ID };
