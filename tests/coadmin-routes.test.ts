import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, req } from "./helpers/env";

vi.mock("next/headers", async () => (await import("./helpers/env")).nextHeadersMock());
vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));
vi.mock("@/lib/telegram", () => ({ sendTelegramPurchase: async () => {} }));

import { tables, seed, rpcCalls } from "./helpers/fake-supabase";
import { buildWorld, loginAs, HOST_A, HOST_B, TENANT_B } from "./helpers/world";
import { OWNER_TENANT_ID } from "@/lib/tenant";
import { hashPassword, createSessionToken } from "@/lib/auth";
import { buildThemeCss, validateTheme, DEFAULT_THEME, contrastRatio, PRESETS } from "@/lib/theme";
import { slugProblem } from "@/lib/tenant-admin";

import { GET as tenantsGet, POST as tenantsPost } from "@/app/api/admin/tenants/route";
import { GET as brandingGet, POST as brandingPost } from "@/app/api/admin/branding/route";
import { POST as apply, GET as applyGet } from "@/app/api/tenant/apply/route";
import { GET as slugCheck } from "@/app/api/tenant/slug-check/route";
import { GET as brandGet } from "@/app/api/tenant/brand/route";

const APP = {
  brandName: "Raj Hub", slug: "rajhub", telegramUsername: "@rajhub", inventoryMode: "own_api",
  contactEmail: "r@x.test", contactPhone: "9876543210", coadminUsername: "rajadmin", coadminPassword: "Str0ng-pass!",
};

beforeEach(() => {
  buildWorld();
  vi.unstubAllEnvs();
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("PLATFORM_ROOT_DOMAIN", "shopnet.example");
  seed("users", [{ id: "user-res", tenant_id: OWNER_TENANT_ID, username: "resA", role: "reseller", password: hashPassword("pw-res-1"), email: "", mobile_number: "9999999999" }]);
  seed("users", [{ id: "user-resB", tenant_id: TENANT_B, username: "resB", role: "reseller", password: hashPassword("pw-res-2"), email: "", mobile_number: "9999999999" }]);
});

function asReseller() {
  loginAs("rajA", OWNER_TENANT_ID, "raj", HOST_A);
  // swap to the reseller account created above
  ctx.cookie = createSessionToken("resA", tables.users.find((u) => u.id === "user-res")!.password, "user-res", OWNER_TENANT_ID);
}

describe("owner-only management", () => {
  it("co-admin, store-B 'admin', customers and anonymous all get 401/403 on the owner routes", async () => {
    ctx.cookie = ""; ctx.host = HOST_A;
    expect((await tenantsGet(req("/api/admin/tenants", { host: HOST_A }))).status).toBe(401);
    for (const [key, tid, name] of [["coadminB", TENANT_B, "andrew"], ["fakeAdminB", TENANT_B, "sneaky"], ["rajA", OWNER_TENANT_ID, "raj"]] as const) {
      const host = tid === TENANT_B ? HOST_B : HOST_A;
      loginAs(key, tid, name, host);
      expect((await tenantsGet(req("/api/admin/tenants", { host }))).status, key).toBe(403);
      const r = await tenantsPost(req("/api/admin/tenants", { host, method: "POST", body: { action: "suspend", id: OWNER_TENANT_ID, reason: "x" } }));
      expect(r.status, key).toBe(403);
    }
    expect(rpcCalls.filter((c) => c.name.startsWith("jprime_set_tenant") || c.name.includes("approve"))).toEqual([]);
  });
  it("owner can list, approve and suspend; ids are validated and the root domain is passed on", async () => {
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    expect((await tenantsGet(req("/api/admin/tenants", { host: HOST_A }))).status).toBe(200);
    const bad = await tenantsPost(req("/api/admin/tenants", { host: HOST_A, method: "POST", body: { action: "approve", id: "1; drop table" } }));
    expect(bad.status).toBe(400);
    const ok = await tenantsPost(req("/api/admin/tenants", { host: HOST_A, method: "POST", body: { action: "approve", id: "00000000-0000-0000-0000-0000000000aa" } }));
    expect(ok.status).toBe(200);
    const call = rpcCalls.find((c) => c.name === "jprime_approve_tenant_application")!;
    expect(call.args).toMatchObject({ p_actor_name: "boss", p_root_domain: "shopnet.example" });
  });
  it("the overview never contains password hashes", async () => {
    seed("tenant_applications", [{ id: "00000000-0000-0000-0000-0000000000ab", brand_name: "X", slug: "xx1", status: "pending", coadmin_username: "u", coadmin_password_hash: "scrypt$SECRET$HASH", created_at: new Date().toISOString() }]);
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    const body = await (await tenantsGet(req("/api/admin/tenants", { host: HOST_A }))).text();
    expect(body).not.toMatch(/SECRET|scrypt/);
    expect(body).toMatch(/"slug":"xx1"/);
  });
});

describe("Launch Your Own Website application", () => {
  it("only a reseller may apply; customers are refused", async () => {
    loginAs("rajA", OWNER_TENANT_ID, "raj", HOST_A);
    expect((await apply(req("/api/tenant/apply", { method: "POST", host: HOST_A, body: APP }))).status).toBe(403);
    expect((await applyGet(req("/api/tenant/apply", { host: HOST_A }))).status).toBe(200);
    expect(tables.tenant_applications ?? []).toHaveLength(0);
  });
  it("a reseller creates a PENDING application; password is hashed; tenant is forced from the session, not the body", async () => {
    asReseller();
    const r = await apply(req("/api/tenant/apply", { method: "POST", host: HOST_A, body: { ...APP, applicant_tenant_id: TENANT_B, status: "approved", tenant_id: TENANT_B } }));
    expect(r.status).toBe(200);
    const row = tables.tenant_applications[0];
    expect(row).toMatchObject({ status: "pending", applicant_tenant_id: OWNER_TENANT_ID, applicant_user_id: "user-res", slug: "rajhub" });
    expect(row.coadmin_password_hash).toMatch(/^scrypt\$/);
    expect(JSON.stringify(row)).not.toContain("Str0ng-pass!");
    expect(tables.tenants.find((t) => t.slug === "rajhub")).toBeUndefined(); // nothing goes live until the owner approves
  });
  it("rejects duplicate application, taken/reserved/invalid slugs and weak input", async () => {
    asReseller();
    expect((await apply(req("/api/tenant/apply", { method: "POST", host: HOST_A, body: APP }))).status).toBe(200);
    expect((await apply(req("/api/tenant/apply", { method: "POST", host: HOST_A, body: { ...APP, slug: "other1" } }))).status).toBe(409);
    tables.tenant_applications.length = 0;
    for (const body of [
      { ...APP, slug: "andrews" }, { ...APP, slug: "admin" }, { ...APP, slug: "my-jprime" }, { ...APP, slug: "A B" },
      { ...APP, coadminPassword: "short" }, { ...APP, brandName: "x" }, { ...APP, contactPhone: "123" }, { ...APP, telegramUsername: "a b" },
    ]) {
      const r = await apply(req("/api/tenant/apply", { method: "POST", host: HOST_A, body }));
      expect(r.status, JSON.stringify(body)).toBeGreaterThanOrEqual(400);
    }
    expect(tables.tenant_applications ?? []).toHaveLength(0);
  });
  it("slug-check needs login and reports availability", async () => {
    ctx.cookie = "";
    expect((await slugCheck(req("/api/tenant/slug-check?slug=rajhub", { host: HOST_A }))).status).toBe(401);
    asReseller();
    expect(await (await slugCheck(req("/api/tenant/slug-check?slug=rajhub", { host: HOST_A }))).json()).toMatchObject({ available: true });
    expect(await (await slugCheck(req("/api/tenant/slug-check?slug=andrews", { host: HOST_A }))).json()).toMatchObject({ available: false });
  });
  it("slugProblem rules", () => {
    for (const s of ["rajhub", "a1b", "my-store-2"]) expect(slugProblem(s)).toBeNull();
    for (const s of ["ab", "-ab", "ab-", "a--b", "Aaa", "www", "jprimeshop", "x".repeat(40), "a.b"]) expect(slugProblem(s), s).not.toBeNull();
  });
});

describe("branding", () => {
  it("each store edits only its own theme; a customer cannot edit; the owner store stays untouched", async () => {
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    const r = await brandingPost(req("/api/admin/branding", { method: "POST", host: HOST_B, body: { brandName: "Andrew Shop", theme: { preset: "ocean" }, tenant_id: OWNER_TENANT_ID } }));
    expect(r.status).toBe(200);
    expect(tables.tenant_settings.find((s) => s.tenant_id === TENANT_B)?.theme.primary).toBe("#0ea5e9");
    expect(tables.tenant_settings.find((s) => s.tenant_id === OWNER_TENANT_ID)).toBeUndefined();
    expect(tables.tenants.find((t) => t.id === TENANT_B)?.brand_name).toBe("Andrew Shop");
    expect(tables.tenants.find((t) => t.id === OWNER_TENANT_ID)?.brand_name).toBe("JPRIME STORE");
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    expect((await brandingPost(req("/api/admin/branding", { method: "POST", host: HOST_B, body: { theme: { preset: "sunset" } } }))).status).toBe(403);
    expect((await brandingGet(req("/api/admin/branding", { host: HOST_B }))).status).toBe(403);
  });
  it("co-admin cannot brand themselves JPRIME; bad colors/urls/fonts are rejected", async () => {
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    const post = (body: any) => brandingPost(req("/api/admin/branding", { method: "POST", host: HOST_B, body }));
    expect((await post({ brandName: "JPRIME Official" })).status).toBe(400);
    for (const theme of [
      { primary: "red" }, { primary: "#fff" }, { primary: "#ff0000;} body{display:none" }, { background: "url(javascript:alert(1))" },
      { font: "Comic; background:url(x)" }, { logoUrl: "javascript:alert(1)" }, { logoUrl: "http://x.test/a.png" },
      { logoUrl: "https://x.test/a.png\" onerror=\"x" }, { foreground: "#111111", background: "#121212" },
    ]) expect((await post({ theme })).status, JSON.stringify(theme)).toBe(400);
    expect(tables.tenant_settings?.find((s) => s.tenant_id === TENANT_B)).toBeUndefined();
  });
  it("text fields are stripped of markup", () => {
    const r = validateTheme({ tagline: "<script>alert(1)</script>Best" });
    expect(r.ok && r.theme.tagline).not.toMatch(/[<>]/);
  });
  it("generated CSS only contains validated values (no injection even from a poisoned DB row)", () => {
    const css = buildThemeCss({ ...DEFAULT_THEME, primary: "#ff0000;} *{display:none" as any, font: "x" as any });
    expect(css).not.toContain("display:none");
    expect(css).not.toMatch(/[<>]|javascript|url\(|@import/i);
    const good = buildThemeCss(validateTheme({ preset: "emerald", font: "serif" }).ok ? (validateTheme({ preset: "emerald", font: "serif" }) as any).theme : DEFAULT_THEME);
    expect(good).toContain("--color-violet-500:#10b981");
    expect(good).toContain("serif");
  });
  it("every preset is readable", () => {
    for (const [k, p] of Object.entries<any>(PRESETS)) expect(contrastRatio(p.foreground, p.background), k).toBeGreaterThan(4.5);
  });
  it("public brand endpoint reflects the HOST's store only", async () => {
    seed("tenant_settings", [{ tenant_id: TENANT_B, theme: { preset: "ocean" } }]);
    const b = await (await brandGet()).json();
    expect(b.brand.name).toBe("JPRIME STORE"); // ctx.host is the owner
    expect(b.brand.theme).toBeNull();
    ctx.host = HOST_B;
    const bb = await (await brandGet()).json();
    expect(bb.brand).toMatchObject({ name: "Andrews", slug: "andrews" });
    expect(bb.brand.theme.primary).toBe("#0ea5e9");
    expect(JSON.stringify(bb)).not.toMatch(/password|secret|token/i);
  });
});
