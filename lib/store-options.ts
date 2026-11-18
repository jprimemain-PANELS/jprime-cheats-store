import { OWNER_TENANT_ID } from "@/lib/tenant";
import { readSetting, writeSetting, isUuid, settingKey } from "@/lib/tenant-db";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { parseVideoSource } from "@/lib/video";
import { cleanDesign, isDesignId, type DesignId } from "@/lib/store-designs";

/**
 * Per-store switches that are plain settings (no migration): stored as one JSON value in app_settings under
 * the store's private key prefix, so one store can never read or change another store's options.
 */
export type StoreOptions = {
  tutorialOn: boolean;      // "How to use this site" box on the login page
  tutorialUrl: string;      // YouTube (or video) link
  upgradeOn: boolean;       // customers may pay to become a reseller
  upgradePrice: number;     // rupees
  resellerLaunch: boolean;  // OWNER decides: may this store's resellers see "Launch your website"?
  launchMode: LaunchMode;   // OWNER decides who gets the plan money: "main" = the main website, "own" = this co-admin's own website
  design: DesignId;         // OWNER picks the whole-page store design ("classic" = the original look)
};
export type LaunchMode = "main" | "own";
export const OPTIONS_KEY = "store_options";
export const DEFAULT_UPGRADE_PRICE = 99;

export function defaultOptions(tenantId: string): StoreOptions {
  // Owner keeps today's behaviour (box visible); co-admin stores start with it off until they add a link.
  return { tutorialOn: tenantId === OWNER_TENANT_ID, tutorialUrl: "", upgradeOn: false, upgradePrice: DEFAULT_UPGRADE_PRICE, resellerLaunch: false, launchMode: "main", design: "classic" };
}

function clean(raw: any, tenantId: string): StoreOptions {
  const d = defaultOptions(tenantId);
  const o = raw && typeof raw === "object" ? raw : {};
  const price = Math.round(Number(o.upgradePrice));
  return {
    tutorialOn: typeof o.tutorialOn === "boolean" ? o.tutorialOn : d.tutorialOn,
    tutorialUrl: typeof o.tutorialUrl === "string" ? o.tutorialUrl.slice(0, 300) : d.tutorialUrl,
    upgradeOn: o.upgradeOn === true,
    upgradePrice: Number.isFinite(price) && price >= 1 && price <= 100000 ? price : d.upgradePrice,
    resellerLaunch: o.resellerLaunch === true,
    launchMode: o.launchMode === "own" ? "own" : "main",
    design: cleanDesign(o.design),
  };
}

const OPTIONS_TTL_MS = 60_000;
const optionsCache = new Map<string, { at: number; value: StoreOptions }>();
export function clearOptionsCache(tenantId?: string) { if (tenantId) optionsCache.delete(tenantId); else optionsCache.clear(); }

export async function getStoreOptions(tenantId: string): Promise<StoreOptions> {
  const hit = process.env.VITEST ? undefined : optionsCache.get(tenantId);
  if (hit && Date.now() - hit.at < OPTIONS_TTL_MS) return hit.value;
  try {
    const r = await readSetting(tenantId, OPTIONS_KEY);
    const value = clean((r.data as any)?.value, tenantId);
    if (!process.env.VITEST) optionsCache.set(tenantId, { at: Date.now(), value });
    return value;
  } catch {
    return defaultOptions(tenantId);
  }
}

/** The store admin edits THEIR store's own options. `resellerLaunch` is never accepted here (owner only). */
export async function saveStoreOptions(tenantId: string, patch: any): Promise<{ ok: true; options: StoreOptions } | { ok: false; error: string }> {
  const cur = await getStoreOptions(tenantId);
  const next: StoreOptions = { ...cur };
  if (patch?.tutorialOn !== undefined) next.tutorialOn = patch.tutorialOn === true;
  if (patch?.tutorialUrl !== undefined) {
    const u = String(patch.tutorialUrl ?? "").trim();
    if (u && (u.length > 300 || !/^https:\/\//i.test(u) || !parseVideoSource(u))) return { ok: false, error: "Paste a full YouTube link that starts with https://" };
    next.tutorialUrl = u;
  }
  if (patch?.upgradeOn !== undefined) next.upgradeOn = patch.upgradeOn === true;
  if (patch?.upgradePrice !== undefined) {
    const p = Math.round(Number(patch.upgradePrice));
    if (!Number.isFinite(p) || p < 1 || p > 100000) return { ok: false, error: "Upgrade price must be between ₹1 and ₹100000." };
    next.upgradePrice = p;
  }
  if (next.tutorialOn && tenantId !== OWNER_TENANT_ID && !next.tutorialUrl) return { ok: false, error: "Add your YouTube link first, or switch the box off." };
  const w = await writeSetting(tenantId, OPTIONS_KEY, next);
  clearOptionsCache(tenantId);
  if (w.error) return { ok: false, error: "Could not save. Make sure the app_settings table exists." };
  return { ok: true, options: next };
}

const WELCOME_KEY = "welcome_since";
export const WELCOME_DAYS = 5;

/**
 * The co-admin "Welcome" steps card: shown during the first 5 days after the store admin first opens it, then never again.
 * The clock starts at the first call and is kept on the server (not in the browser), so another device cannot restart it.
 */
export async function welcomeState(tenantId: string, now = Date.now()): Promise<{ show: boolean }> {
  if (tenantId === OWNER_TENANT_ID) return { show: false };
  try {
    const r = await readSetting(tenantId, WELCOME_KEY);
    const iso = String((r.data as any)?.value?.since ?? "");
    let since = Date.parse(iso);
    if (!Number.isFinite(since)) {
      since = now;
      await writeSetting(tenantId, WELCOME_KEY, { since: new Date(now).toISOString() });
    }
    return { show: now - since < WELCOME_DAYS * 24 * 3600 * 1000 };
  } catch {
    return { show: true };
  }
}

/** OWNER ONLY (route enforces): allow or stop a store's resellers from launching their own websites. */
export async function setResellerLaunch(tenantId: string, allowed: boolean, mode: LaunchMode = "main") {
  if (!isUuid(tenantId) || tenantId === OWNER_TENANT_ID) return { ok: false as const, reason: "Invalid store." };
  const cur = await getStoreOptions(tenantId);
  const w = await writeSetting(tenantId, OPTIONS_KEY, { ...cur, resellerLaunch: allowed === true, launchMode: mode === "own" ? "own" : "main" });
  clearOptionsCache(tenantId);
  return w.error ? { ok: false as const, reason: "Could not save." } : { ok: true as const };
}

/** OWNER ONLY (route enforces): choose a store's page design. Works for any store, including the main one. */
export async function setStoreDesign(tenantId: string, design: unknown) {
  if (!isUuid(tenantId)) return { ok: false as const, reason: "Invalid store." };
  if (!isDesignId(design)) return { ok: false as const, reason: "Unknown design." };
  const cur = await getStoreOptions(tenantId);
  const w = await writeSetting(tenantId, OPTIONS_KEY, { ...cur, design });
  clearOptionsCache(tenantId);
  return w.error ? { ok: false as const, reason: "Could not save." } : { ok: true as const };
}

/** For the owner's store cards: one query for every store. */
export async function resellerLaunchMap(ids: string[]): Promise<Record<string, { on: boolean; mode: LaunchMode; design: DesignId }>> {
  const out: Record<string, { on: boolean; mode: LaunchMode; design: DesignId }> = {};
  const valid = ids.filter((i) => isUuid(i) && i !== OWNER_TENANT_ID);
  if (!valid.length) return out;
  const r = await supabaseAdmin.from("app_settings").select("key, value").in("key", valid.map((i) => settingKey(i, OPTIONS_KEY)));
  for (const row of ((r.data as any[]) ?? [])) {
    const id = String(row.key).split(":")[1];
    out[id] = { on: row.value?.resellerLaunch === true, mode: row.value?.launchMode === "own" ? "own" : "main", design: cleanDesign(row.value?.design) };
  }
  return out;
}

/** What the browser may know (no secrets here, it is public store configuration). */
export function publicOptions(o: StoreOptions) {
  return { tutorialOn: o.tutorialOn, tutorialUrl: o.tutorialUrl, upgradeOn: o.upgradeOn, upgradePrice: o.upgradePrice, resellerLaunch: o.resellerLaunch, launchMode: o.launchMode, design: o.design };
}
