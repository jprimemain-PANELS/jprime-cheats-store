import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, req } from "./helpers/env";

vi.mock("next/headers", async () => (await import("./helpers/env")).nextHeadersMock());
vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));
// the per-user/IP limiter is unrelated to these checks and would trip on the many calls below
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), rateLimit: () => true }));
vi.mock("@/lib/telegram", () => ({ sendTelegramPurchase: async () => {} }));

import { tables, seed } from "./helpers/fake-supabase";
import { buildWorld, loginAs, HOST_A, HOST_B, TENANT_B } from "./helpers/world";
import { OWNER_TENANT_ID, resolveTenantByHost, clearTenantCache, canTransact } from "@/lib/tenant";
import { hashPassword, createSessionToken } from "@/lib/auth";
import { GET as subGet, POST as subPost } from "@/app/api/admin/subscription/route";
import { POST as apply, GET as applyGet } from "@/app/api/tenant/apply/route";

const FORM = {
  brandName: "Raj Hub", slug: "rajhub", telegramUsername: "@rajhub", contactEmail: "r@x.test", contactPhone: "9876543210",
  coadminUsername: "rajadmin", coadminPassword: "Str0ng-pass!", domainChoice: "free",
};

beforeEach(() => {
  buildWorld();
  vi.unstubAllEnvs();
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("PLATFORM_ROOT_DOMAIN", "shopnet.example");
  seed("users", [{ id: "user-res", tenant_id: OWNER_TENANT_ID, username: "resA", role: "reseller", password: hashPassword("pw-res-1"), email: "", mobile_number: "9999999999" }]);
  seed("users", [{ id: "user-res2", tenant_id: OWNER_TENANT_ID, username: "resB", role: "reseller", password: hashPassword("pw-res-2"), email: "", mobile_number: "9999999999" }]);
});
const asRes = (id = "user-res", name = "resA") => {
  ctx.host = HOST_A;
  ctx.cookie = createSessionToken(name, tables.users.find((u) => u.id === id)!.password, id, OWNER_TENANT_ID);
};
const launch = (body: any = FORM) => apply(req("/api/tenant/apply", { method: "POST", host: HOST_A, body }));

describe("expiry behaves like a suspended store; NULL never expires", () => {
  it("expired plan -> suspended (no purchases); running plan and NULL stay active", async () => {
    const t = tables.tenants.find((x) => x.id === TENANT_B) as any;
    clearTenantCache(); expect((await resolveTenantByHost(HOST_B))?.status).toBe("active");           // NULL
    t.plan_expires_at = new Date(Date.now() + 86400000).toISOString(); clearTenantCache();
    expect(canTransact(await resolveTenantByHost(HOST_B))).toBe(true);                                // running
    t.plan_expires_at = new Date(Date.now() - 1000).toISOString(); clearTenantCache();
    const r = await resolveTenantByHost(HOST_B);
    expect(r?.status).toBe("suspended"); expect(r?.subscriptionExpired).toBe(true); expect(canTransact(r)).toBe(false);
    // the owner can never expire, even with a bogus value
    (tables.tenants.find((x) => x.id === OWNER_TENANT_ID) as any).plan_expires_at = new Date(Date.now() - 1000).toISOString(); clearTenantCache();
    expect((await resolveTenantByHost(HOST_A))?.status).toBe("active");
  });
});

describe("instant launch (no approval)", () => {
  it("reseller launches: store + free address + trial, no owner action; second attempt refused", async () => {
    asRes();
    const r = await launch();
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j).toMatchObject({ success: true, launched: true, url: "https://rajhub.shopnet.example" });
    const t = tables.tenants.find((x) => x.slug === "rajhub") as any;
    expect(t).toMatchObject({ kind: "coadmin", status: "active", trial_used: true, payer_username: "resA" });
    const days = (new Date(t.plan_expires_at).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(2.9); expect(days).toBeLessThanOrEqual(3.01);
    expect(tables.tenant_domains.find((d) => d.host === "rajhub.shopnet.example")).toMatchObject({ tenant_id: t.id, verified: true });
    // one store per reseller
    const again = await launch({ ...FORM, slug: "second1", coadminUsername: "other" });
    expect(again.status).toBe(409);
    expect(tables.tenants.filter((x) => x.kind === "coadmin" && x.slug !== "andrews" && x.slug !== "pending")).toHaveLength(1);
    // a different reseller can still launch
    asRes("user-res2", "resB");
    expect((await launch({ ...FORM, slug: "other1", coadminUsername: "adm2" })).status).toBe(200);
  });
  it("customers are refused; bad input creates nothing", async () => {
    loginAs("rajA", OWNER_TENANT_ID, "raj", HOST_A);
    expect((await launch()).status).toBe(403);
    asRes();
    for (const bad of [{ slug: "admin" }, { slug: "jprime-x" }, { slug: "ab" }, { brandName: "x" }, { coadminPassword: "short" }, { telegramUsername: "a" }, { contactPhone: "123" }]) {
      expect((await launch({ ...FORM, ...bad })).status, JSON.stringify(bad)).toBe(400);
    }
    expect(tables.tenants.find((x) => x.slug === "rajhub")).toBeUndefined();
    expect((tables.tenant_applications ?? []).length).toBe(0);
  });
  it("a bad own-domain is refused BEFORE anything is created", async () => {
    asRes();
    const r = await launch({ ...FORM, domainChoice: "custom", customDomain: "jprimecheats.store" });
    expect(r.status).toBe(400);
    expect(tables.tenants.find((x) => x.slug === "rajhub")).toBeUndefined();
    expect((tables.tenant_applications ?? []).length).toBe(0);
  });
  it("own domain at launch: store is live on the free address and the DNS proof is prepared", async () => {
    asRes();
    const r = await launch({ ...FORM, domainChoice: "custom", customDomain: "Shop.RajStore.com" });
    expect(r.status).toBe(200);
    const j = await r.json();
    const t = tables.tenants.find((x) => x.slug === "rajhub") as any;
    expect(t.custom_domain_allowed).toBe(true);
    expect(j.custom).toMatchObject({ host: "shop.rajstore.com", status: "waiting_dns", cname: "cname.vercel-dns.com" });
    const row = tables.tenant_domains.find((d) => d.host === "shop.rajstore.com") as any;
    expect(row).toMatchObject({ tenant_id: t.id, verified: false, kind: "custom" });
  });
  it("when the platform is not ready (no root domain), it falls back to the old pending application", async () => {
    vi.stubEnv("PLATFORM_ROOT_DOMAIN", "");
    asRes();
    const r = await launch(); expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ success: true });
    expect(tables.tenants.find((x) => x.slug === "rajhub")).toBeUndefined();
    expect((tables.tenant_applications ?? [])[0]).toMatchObject({ status: "pending" });
  });
  it("GET tells the page what is available", async () => {
    asRes();
    const j = await (await applyGet(req("/api/tenant/apply", { host: HOST_A }))).json();
    expect(j.options).toMatchObject({ selfService: true, root: "shopnet.example", trialDays: 3 });
    expect(j.options.plans.monthly.price).toBe(249);
  });
});

describe("subscription API", () => {
  it("only the store's own co-admin; owner store has no plan; customers/anonymous refused", async () => {
    ctx.cookie = ""; expect((await subGet(req("/api/admin/subscription", { host: HOST_B }))).status).toBe(401);
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    expect((await subGet(req("/api/admin/subscription", { host: HOST_B }))).status).toBe(403);
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    const j = await (await subGet(req("/api/admin/subscription", { host: HOST_B }))).json();
    expect(j).toMatchObject({ success: true, owner: false });
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    expect(await (await subGet(req("/api/admin/subscription", { host: HOST_A }))).json()).toMatchObject({ owner: true });
    expect((await subPost(req("/api/admin/subscription", { host: HOST_A, method: "POST", body: { plan: "weekly" } }))).status).toBe(403);
  });
  it("unknown plan names are rejected and nothing is charged", async () => {
    seed("wallets", [{ tenant_id: OWNER_TENANT_ID, username: "resA", balance: 1000 }]);
    (tables.tenants.find((x) => x.id === TENANT_B) as any).payer_username = "resA";
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    for (const plan of ["free", "", "WEEKLY", "monthly; drop"]) {
      expect((await subPost(req("/api/admin/subscription", { host: HOST_B, method: "POST", body: { plan } }))).status, plan).toBe(400);
    }
    expect((tables.wallets.find((w) => w.username === "resA") as any).balance).toBe(1000);
  });
  it("an owner-suspended store cannot buy its way back; an EXPIRED store can renew", async () => {
    const t = tables.tenants.find((x) => x.id === TENANT_B) as any;
    t.status = "suspended"; clearTenantCache();
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    expect((await subPost(req("/api/admin/subscription", { host: HOST_B, method: "POST", body: { plan: "weekly" } }))).status).toBe(403);
  });
});
