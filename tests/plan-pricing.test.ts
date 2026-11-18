import { beforeEach, describe, expect, it, vi } from "vitest";
import { req } from "./helpers/env";

vi.mock("next/headers", async () => (await import("./helpers/env")).nextHeadersMock());
vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));
vi.mock("@/lib/telegram", () => ({ sendTelegramPurchase: async () => {} }));

import { tables } from "./helpers/fake-supabase";
import { buildWorld, loginAs, HOST_A, HOST_B, TENANT_B } from "./helpers/world";
import { OWNER_TENANT_ID, clearTenantCache } from "@/lib/tenant";
import { cleanPlanConfig, getPlanConfig, planViews, savePlanConfig, defaultPlanConfig } from "@/lib/plan-settings";
import { GET as plansGet, POST as plansPost } from "@/app/api/admin/plans/route";
import { GET as subStoresGet } from "@/app/api/admin/sub-stores/route";
import { POST as tenantsPost } from "@/app/api/admin/tenants/route";
import { GET as tenantsGet } from "@/app/api/admin/tenants/route";
import { getStoreOptions } from "@/lib/store-options";

const tpost = (host: string, body: any) => tenantsPost(req("/api/admin/tenants", { method: "POST", body, host }));
const ppost = (host: string, body: any) => plansPost(req("/api/admin/plans", { method: "POST", body, host }));
beforeEach(() => { buildWorld(); clearTenantCache(); });

describe("plan config", () => {
  it("defaults equal today's prices, bad values fall back, 'Save X%' is computed", () => {
    expect(defaultPlanConfig()).toEqual({ prices: { weekly: 90, monthly: 249, quarterly: 695 }, trialDays: 3 });
    expect(cleanPlanConfig({ prices: { weekly: -5, monthly: "abc", quarterly: 99999999 }, trialDays: 99 })).toEqual(defaultPlanConfig());
    expect(planViews(defaultPlanConfig()).quarterly.note).toBe("Save 7%");
    expect(planViews({ prices: { weekly: 10, monthly: 30, quarterly: 90 }, trialDays: 1 }).quarterly.note).toBe("");
  });
  it("save validates and persists per store", async () => {
    expect((await savePlanConfig(TENANT_B, { prices: { monthly: 0 } })).ok).toBe(false);
    expect((await savePlanConfig(TENANT_B, { trialDays: 31 })).ok).toBe(false);
    expect((await savePlanConfig(TENANT_B, { prices: { monthly: 300 }, trialDays: 7 })).ok).toBe(true);
    expect((await getPlanConfig(TENANT_B)).prices.monthly).toBe(300);
    expect((await getPlanConfig(TENANT_B)).trialDays).toBe(7);
    expect((await getPlanConfig(OWNER_TENANT_ID)).prices.monthly).toBe(249);
  });
});

describe("plans + launch-mode routes", () => {
  it("owner edits main-website prices; a normal co-admin cannot; guests cannot", async () => {
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    expect((await ppost(HOST_A, { prices: { weekly: 80, monthly: 220, quarterly: 600 }, trialDays: 5 })).status).toBe(200);
    expect((await (await plansGet(req("/api/admin/plans", { host: HOST_A }))).json())).toMatchObject({ prices: { monthly: 220 }, trialDays: 5 });
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    expect((await plansGet(req("/api/admin/plans", { host: HOST_B }))).status).toBe(403);
    expect((await ppost(HOST_B, { trialDays: 9 })).status).toBe(403);
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    expect([401, 403]).toContain((await ppost(HOST_B, { trialDays: 9 })).status);
  });
  it("owner picks main-web or own-web; only own-web unlocks the co-admin's price editor and sub-store list", async () => {
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    expect((await tpost(HOST_A, { action: "reseller_launch", id: TENANT_B, allowed: true, mode: "main" })).status).toBe(200);
    expect((await getStoreOptions(TENANT_B))).toMatchObject({ resellerLaunch: true, launchMode: "main" });
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    expect((await plansGet(req("/api/admin/plans", { host: HOST_B }))).status).toBe(403);
    expect((await (await subStoresGet(req("/api/admin/sub-stores", { host: HOST_B }))).json()).enabled).toBe(false);
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    expect((await tpost(HOST_A, { action: "reseller_launch", id: TENANT_B, allowed: true, mode: "own" })).status).toBe(200);
    expect(await getStoreOptions(TENANT_B)).toMatchObject({ resellerLaunch: true, launchMode: "own" });
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    expect((await ppost(HOST_B, { prices: { monthly: 150 }, trialDays: 2 })).status).toBe(200);
    expect((await getPlanConfig(TENANT_B)).prices.monthly).toBe(150);
    expect((await getPlanConfig(OWNER_TENANT_ID)).prices.monthly).toBe(249); // owner's prices untouched
    expect((await (await subStoresGet(req("/api/admin/sub-stores", { host: HOST_B }))).json()).enabled).toBe(true);
    // turning it off closes both again
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    await tpost(HOST_A, { action: "reseller_launch", id: TENANT_B, allowed: false });
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    expect((await plansGet(req("/api/admin/plans", { host: HOST_B }))).status).toBe(403);
  });
  it("the owner's store list reports each store's mode", async () => {
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    await tpost(HOST_A, { action: "reseller_launch", id: TENANT_B, allowed: true, mode: "own" });
    const j = await (await tenantsGet(req("/api/admin/tenants", { host: HOST_A }))).json();
    const b = j.stores.find((s: any) => s.id === TENANT_B);
    expect(b).toMatchObject({ resellerLaunch: true, launchMode: "own" });
  });
});
