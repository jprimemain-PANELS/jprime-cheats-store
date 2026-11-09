import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, req } from "./helpers/env";

vi.mock("next/headers", async () => (await import("./helpers/env")).nextHeadersMock());
vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));
vi.mock("@/lib/telegram", () => ({ sendTelegramPurchase: async () => {} }));
const dnsState = { txt: [] as string[][], a: [] as string[], cname: [] as string[] };
vi.mock("node:dns", () => ({
  promises: {
    resolveTxt: async () => { if (!dnsState.txt.length) throw new Error("ENODATA"); return dnsState.txt; },
    resolve4: async () => { if (!dnsState.a.length) throw new Error("ENODATA"); return dnsState.a; },
    resolveCname: async () => { if (!dnsState.cname.length) throw new Error("ENODATA"); return dnsState.cname; },
  },
}));

import { tables, seed } from "./helpers/fake-supabase";
import { buildWorld, loginAs, HOST_A, HOST_B, TENANT_B, TENANT_C } from "./helpers/world";
import { OWNER_TENANT_ID, resolveTenantByHost, clearTenantCache } from "@/lib/tenant";
import { parseCustomDomain } from "@/lib/domains";
import { buildThemeCss, validateTheme, DEFAULT_THEME, PRESETS, STRUCTURE_DEFAULTS, themeFromStored } from "@/lib/theme";
import { sessionCookieName } from "@/lib/auth";
import { GET as domGet, POST as domPost } from "@/app/api/admin/domain/route";
import { POST as tenantsPost } from "@/app/api/admin/tenants/route";

beforeEach(() => {
  buildWorld();
  vi.unstubAllEnvs();
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("PLATFORM_ROOT_DOMAIN", "shopnet.example");
  dnsState.txt = []; dnsState.a = []; dnsState.cname = [];
  for (const t of tables.tenants) (t as any).custom_domain_allowed = false;
});

const post = (host: string, body: any) => domPost(req("/api/admin/domain", { host, method: "POST", body }));
const owner = (body: any) => tenantsPost(req("/api/admin/tenants", { host: HOST_A, method: "POST", body }));
const asCoadmin = () => loginAs("coadminB", TENANT_B, "andrew", HOST_B);
const allow = () => { (tables.tenants.find((t) => t.id === TENANT_B) as any).custom_domain_allowed = true; };

describe("parseCustomDomain (claim abuse)", () => {
  it("accepts normal domains", () => {
    expect(parseCustomDomain("Shop.Example.com")).toEqual({ host: "shop.example.com" });
    expect(parseCustomDomain("example.in")).toEqual({ host: "example.in" });
  });
  it("rejects owner hosts, the platform root and their subdomains", () => {
    for (const bad of ["jprimecheats.store", "www.jprimecheats.store", "evil.jprimecheats.store", "shopnet.example", "x.shopnet.example"])
      expect(parseCustomDomain(bad), bad).toHaveProperty("error");
  });
  it("rejects URLs, ports, wildcards, IPs, platform suffixes, junk", () => {
    for (const bad of ["https://a.com", "a.com/path", "a.com:8080", "*.a.com", "1.2.3.4", "foo.vercel.app", "localhost", "a", "a..com", "-a.com", "a_b.com", "xn--e1afmkfd.com", "a.com?x=1", "user@a.com", "", "a b.com"])
      expect(parseCustomDomain(bad), bad).toHaveProperty("error");
  });
  it("honours OWNER_EXTRA_HOSTS", () => {
    vi.stubEnv("OWNER_EXTRA_HOSTS", "ownerbrand.in");
    expect(parseCustomDomain("ownerbrand.in")).toHaveProperty("error");
    expect(parseCustomDomain("pay.ownerbrand.in")).toHaveProperty("error");
  });
});

describe("co-admin custom domain flow", () => {
  it("is refused until the owner allows it", async () => {
    asCoadmin();
    const r = await post(HOST_B, { action: "request", domain: "shop.raj.com" });
    expect(r.status).toBe(400);
    expect((tables.tenant_domains.filter((d) => d.kind === "custom"))).toHaveLength(0);
  });
  it("request -> TXT proof -> still NOT live -> owner activates -> serves that store", async () => {
    allow(); asCoadmin();
    const r = await post(HOST_B, { action: "request", domain: "Shop.Raj.com" });
    expect(r.status).toBe(200);
    const row: any = tables.tenant_domains.find((d) => d.host === "shop.raj.com");
    expect(row).toMatchObject({ tenant_id: TENANT_B, kind: "custom", verified: false });
    expect(row.verify_token).toMatch(/^store-verify-[0-9a-f]{32}$/);

    // not live: the host resolves to nothing (and NEVER falls back to the owner store in production)
    clearTenantCache();
    expect(await resolveTenantByHost("shop.raj.com")).toBeNull();

    // no proof yet
    let c = await (await post(HOST_B, { action: "check" })).json();
    expect(c.proofFound).toBe(false);
    // wrong proof
    dnsState.txt = [["store-verify-deadbeef"]];
    c = await (await post(HOST_B, { action: "check" })).json();
    expect(c.proofFound).toBe(false);
    // right proof
    dnsState.txt = [[row.verify_token]];
    c = await (await post(HOST_B, { action: "check" })).json();
    expect(c.proofFound).toBe(true);
    expect((tables.tenant_domains.find((d) => d.host === "shop.raj.com") as any).verified).toBe(false); // co-admin cannot self-activate

    // owner activates (confirming Vercel step)
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    const noConfirm = await owner({ action: "domain_activate", host: "shop.raj.com" });
    expect(noConfirm.status).toBe(400);
    const ok = await owner({ action: "domain_activate", host: "shop.raj.com", addedInVercel: true });
    expect(ok.status).toBe(200);
    clearTenantCache();
    expect((await resolveTenantByHost("shop.raj.com"))?.id).toBe(TENANT_B);
  });
  it("activation needs proven DNS", async () => {
    allow(); asCoadmin();
    await post(HOST_B, { action: "request", domain: "shop.raj.com" });
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    expect((await owner({ action: "domain_activate", host: "shop.raj.com", addedInVercel: true })).status).toBe(400);
    expect((tables.tenant_domains.find((d) => d.host === "shop.raj.com") as any).verified).toBe(false);
  });
  it("another store cannot take a host that is already requested or live", async () => {
    allow(); asCoadmin();
    await post(HOST_B, { action: "request", domain: "shop.raj.com" });
    (tables.tenants.find((t) => t.id === TENANT_C) as any).custom_domain_allowed = true;
    (tables.tenants.find((t) => t.id === TENANT_C) as any).status = "active";
    // C's co-admin
    seed("users", [{ id: "user-cadm", tenant_id: TENANT_C, username: "cadm", role: "coadmin", password: "x" }]);
    const { createSessionToken } = await import("@/lib/auth");
    ctx.host = "pending.store-c.example"; ctx.cookie = createSessionToken("cadm", "x", "user-cadm", TENANT_C);
    const r = await post("pending.store-c.example", { action: "request", domain: "shop.raj.com" });
    expect(r.status).toBe(400);
    expect(tables.tenant_domains.filter((d) => d.host === "shop.raj.com")).toHaveLength(1);
    expect((tables.tenant_domains.find((d) => d.host === "shop.raj.com") as any).tenant_id).toBe(TENANT_B);
  });
  it("cannot claim the owner's host or another store's free subdomain", async () => {
    allow(); asCoadmin();
    for (const d of ["jprimecheats.store", "www.jprimecheats.store", "andrews.store-b.example", "x.shopnet.example"]) {
      const r = await post(HOST_B, { action: "request", domain: d });
      expect(r.status, d).toBe(400);
    }
    // an existing mapped host (owner row) is untouched
    expect(tables.tenant_domains.find((d) => d.host === HOST_A)).toMatchObject({ tenant_id: OWNER_TENANT_ID, verified: true });
  });
  it("customers and anonymous users cannot use the domain API; the owner store has no custom domain", async () => {
    ctx.cookie = ""; expect((await domGet(req("/api/admin/domain", { host: HOST_B }))).status).toBe(401);
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    expect((await post(HOST_B, { action: "request", domain: "a.com" })).status).toBe(403);
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    expect((await post(HOST_A, { action: "request", domain: "a.com" })).status).toBe(403);
  });
  it("a co-admin cannot flip the allow switch or activate; only the owner can", async () => {
    asCoadmin();
    for (const body of [{ action: "custom_allowed", id: TENANT_B, allowed: true }, { action: "domain_activate", host: "a.com", addedInVercel: true }])
      expect((await tenantsPost(req("/api/admin/tenants", { host: HOST_B, method: "POST", body }))).status).toBe(403);
  });
  it("owner can never mark the owner store, and removing frees the host", async () => {
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    expect((await owner({ action: "custom_allowed", id: OWNER_TENANT_ID, allowed: true })).status).toBe(400);
    expect((await owner({ action: "custom_allowed", id: TENANT_B, allowed: true })).status).toBe(200);
    asCoadmin();
    await post(HOST_B, { action: "request", domain: "shop.raj.com" });
    expect((await post(HOST_B, { action: "remove" })).status).toBe(200);
    expect(tables.tenant_domains.filter((d) => d.kind === "custom")).toHaveLength(0);
  });
});

describe("automatic activation (Vercel API configured)", () => {
  it("proof found -> domain added to Vercel and switched on without the owner; no proof -> nothing", async () => {
    vi.stubEnv("VERCEL_TOKEN", "tok"); vi.stubEnv("VERCEL_PROJECT_ID", "prj_1");
    const calls: any[] = [];
    vi.stubGlobal("fetch", async (url: string, init: any) => { calls.push({ url, init }); return { ok: true, json: async () => ({}) }; });
    allow(); asCoadmin();
    await post(HOST_B, { action: "request", domain: "shop.raj.com" });
    let c = await (await post(HOST_B, { action: "check" })).json();
    expect(c.proofFound).toBe(false); expect(calls).toHaveLength(0);
    expect((tables.tenant_domains.find((d) => d.host === "shop.raj.com") as any).verified).toBe(false);
    dnsState.txt = [[(tables.tenant_domains.find((d) => d.host === "shop.raj.com") as any).verify_token]];
    c = await (await post(HOST_B, { action: "check" })).json();
    expect(c.proofFound).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/projects/prj_1/domains"); expect(JSON.parse(calls[0].init.body)).toEqual({ name: "shop.raj.com" });
    expect((tables.tenant_domains.find((d) => d.host === "shop.raj.com") as any).verified).toBe(true);
    clearTenantCache(); expect((await resolveTenantByHost("shop.raj.com"))?.id).toBe(TENANT_B);
    vi.unstubAllGlobals();
  });
  it("a store the owner has NOT allowed never auto-activates", async () => {
    vi.stubEnv("VERCEL_TOKEN", "tok"); vi.stubEnv("VERCEL_PROJECT_ID", "prj_1");
    const calls: any[] = []; vi.stubGlobal("fetch", async (...a: any[]) => { calls.push(a); return { ok: true, json: async () => ({}) }; });
    allow(); asCoadmin();
    await post(HOST_B, { action: "request", domain: "shop.raj.com" });
    (tables.tenants.find((t) => t.id === TENANT_B) as any).custom_domain_allowed = false; // owner switched it off meanwhile
    dnsState.txt = [[(tables.tenant_domains.find((d) => d.host === "shop.raj.com") as any).verify_token]];
    await post(HOST_B, { action: "check" });
    expect(calls).toHaveLength(0);
    expect((tables.tenant_domains.find((d) => d.host === "shop.raj.com") as any).verified).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe("theme v2", () => {
  it("defaults are the original look: no structural CSS", () => {
    const css = buildThemeCss(DEFAULT_THEME);
    for (const frag of ["data-store-card", "font-size", "background-image", "--radius-", "animation-duration"]) expect(css, frag).not.toContain(frag);
  });
  it("a v1 stored theme (missing new fields) loads with defaults", () => {
    const t = themeFromStored({ primary: "#10b981", accent: "#a3e635", background: "#041310", surface: "#08201a", foreground: "#ecfdf5", font: "mono", logoUrl: "", tagline: "hi", announcement: "", footerText: "" });
    expect(t).toMatchObject({ radius: "round", cardStyle: "glass", backdrop: "solid", heroLayout: "centered", columns: 3, motion: true, showStats: true });
  });
  it("rejects bad enums, bad switches, and injected image/text values", () => {
    for (const bad of [{ radius: "50%" }, { cardStyle: "x;}body{display:none" }, { backdrop: "url(javascript:1)" }, { heroLayout: "<script>" }, { columns: 9 }, { columns: "3" }, { fontScale: "huge" }, { buttonStyle: "evil" }, { motion: "yes" }, { showStats: 1 }])
      expect(validateTheme(bad).ok, JSON.stringify(bad)).toBe(false);
    for (const u of ["http://x.com/a.png", "javascript:alert(1)", "https://x.com/a.png\");}body{display:none;/*", "https://x.com/a b.png", "https://u:p@x.com/a.png", "data:image/png;base64,AAA", "https://x.com/a.png'onerror='x"]) {
      expect(validateTheme({ backdropImageUrl: u }).ok, u).toBe(false);
      expect(validateTheme({ heroImageUrl: u }).ok, u).toBe(false);
    }
  });
  it("text is plain: angle brackets and control characters are stripped", () => {
    const r = validateTheme({ heroTitle: "<img src=x onerror=1>\u0000Big", heroSubtitle: "<b>x</b>", ctaText: "Buy<script>" });
    expect(r.ok).toBe(true);
    if (r.ok) for (const k of ["heroTitle", "heroSubtitle", "ctaText"] as const) expect(r.theme[k]).not.toMatch(/[<>\u0000]/);
  });
  it("generated CSS for every preset and option contains only safe characters in interpolated values", () => {
    for (const [name] of Object.entries(PRESETS)) {
      const r = validateTheme({ preset: name, backdrop: "image", backdropImageUrl: "https://cdn.example.com/bg.jpg" });
      expect(r.ok, name).toBe(true);
      if (!r.ok) continue;
      const css = buildThemeCss(r.theme);
      expect(css).toContain('url("https://cdn.example.com/bg.jpg")');
      expect(css).not.toMatch(/<|javascript:|expression\(|@import/i);
    }
  });
  it("structure options produce the matching CSS", () => {
    const mk = (o: any) => { const r = validateTheme(o); if (!r.ok) throw new Error(r.error); return buildThemeCss(r.theme); };
    expect(mk({ cardStyle: "outline" })).toContain("[data-store-card]");
    expect(mk({ radius: "sharp" })).toContain("--radius-3xl:0");
    expect(mk({ radius: "pill" })).toContain("--radius-3xl:2.25rem");
    expect(mk({ fontScale: "large" })).toContain("html{font-size:17px}");
    expect(mk({ motion: false })).toContain("animation-duration");
    expect(mk({ backdrop: "grid" })).toContain("background-size:44px");
    expect(mk({ backdrop: "image" })).not.toContain("url("); // image style without a url falls back to plain
    // single-color buttons: accent == primary
    expect(mk({ buttonStyle: "solid", primary: "#8899ff", accent: "#ff00ff" })).not.toContain("#ff00ff");
  });
  it("applying a preset resets earlier structure choices", () => {
    const a = validateTheme({ preset: "arcade" }); expect(a.ok && a.theme).toMatchObject({ radius: "sharp", columns: 4, heroLayout: "left" });
    if (!a.ok) return;
    const b = validateTheme({ preset: "violet" }, a.theme); expect(b.ok && b.theme).toMatchObject({ radius: "round", columns: 3, heroLayout: "centered", cardStyle: "glass", font: "default" });
  });
  it("every preset passes its own contrast checks", () => {
    for (const name of Object.keys(PRESETS)) expect(validateTheme({ preset: name }).ok, name).toBe(true);
    expect(Object.keys(STRUCTURE_DEFAULTS).length).toBeGreaterThan(5);
  });
});

describe("session cookie scoping", () => {
  it("owner hosts keep the original name; other hosts under the owner domain get a per-host name", () => {
    expect(sessionCookieName("jprimecheats.store")).toBe("jp_session");
    expect(sessionCookieName("www.jprimecheats.store")).toBe("jp_session");
    const a = sessionCookieName("andrews.jprimecheats.store"), b = sessionCookieName("raj.jprimecheats.store");
    expect(a).toMatch(/^jp_s_[0-9a-f]{12}$/); expect(a).not.toBe(b);
    expect(sessionCookieName("shop.raj.com")).toBe("jp_session");
    expect(sessionCookieName(null)).toBe("jp_session");
  });
});
