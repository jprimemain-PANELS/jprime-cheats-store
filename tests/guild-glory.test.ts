import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ctx, req } from "./helpers/env";

vi.mock("next/headers", async () => (await import("./helpers/env")).nextHeadersMock());
vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));
vi.mock("@/lib/telegram", () => ({ sendTelegramPurchase: async () => {} }));

import { tables, seed } from "./helpers/fake-supabase";
import { buildWorld, loginAs, TENANT_B, HOST_A, HOST_B } from "./helpers/world";
import { OWNER_TENANT_ID, clearTenantCache } from "@/lib/tenant";
import { POST as buy } from "@/app/api/guild/buy/route";
import { POST as redeem } from "@/app/api/guild/redeem/route";
import { POST as launch } from "@/app/api/guild/launch/route";
import { GET as me } from "@/app/api/guild/me/route";
import { GET as publicCatalog } from "@/app/api/catalog/route";
import { creditsOfPlan, isGuildId, isTokenCode, makeTokenCode } from "@/lib/guild-glory";

const product = (kind: string) => ({
  tenant_id: OWNER_TENANT_ID, product_id: "gg", name: "Guild Glory Booster",
  data: { id: "gg", name: "Guild Glory Booster", category: "others", kind, status: "ONLINE", prices: [
    { duration: "1 Token", priceINR: "₹70", resellerPrice: "₹60", supplier: "LOCAL" },
    { duration: "5 Tokens", priceINR: "₹300", resellerPrice: "₹250", supplier: "LOCAL" },
  ] },
});
const row = (u: string) => tables.wallets.find((w) => w.tenant_id === OWNER_TENANT_ID && w.username === u);
const bal = (u: string) => Number(row(u)?.balance ?? 0);
const post = (fn: any, path: string, body: any, host = HOST_A) => fn(req(path, { method: "POST", host, body }));
const doBuy = (d = "1 Token", n = "Guild Glory Booster") => post(buy, "/api/guild/buy", { product_name: n, duration: d });
const doRedeem = (code: string) => post(redeem, "/api/guild/redeem", { code });
const doLaunch = (b: any = {}) => post(launch, "/api/guild/launch", { product_name: "Guild Glory Booster", region: "in", guild_id: "123456789", ...b });

let fetchSpy: ReturnType<typeof vi.spyOn>;
let groupsReply: () => Response;
let tick = 0;
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(Date.now() + (++tick) * 120_000);
  buildWorld(); clearTenantCache();
  vi.stubEnv("GUILD_API_URL", "https://seller.example/api/v1"); vi.stubEnv("GUILD_API_KEY", "secret-key");
  seed("products_catalog", [product("guild")]);
  groupsReply = () => json({ ok: true, data: { group_id: "G-1" } }, 201);
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((async (url: any, init: any) => {
    const u = String(url);
    if (u.endsWith("/api/v1/regions")) return json({ ok: true, data: [
      { id: "in", name: "India", code: "IN", available: true, maintenance: false },
      { id: "br", name: "Brazil", code: "BR", available: true, maintenance: true },
      { id: "sg", name: "Singapore", code: "SG", available: false, maintenance: false }] });
    if (u.endsWith("/api/v1/groups") && init?.method === "POST") return groupsReply();
    if (u.endsWith("/api/v1/groups")) return json({ ok: true, data: [{ group_id: "G-1", clan_id: "123456789", region: "in", status: "running" }] });
    return json({ ok: false }, 404);
  }) as any);
  loginAs("rajA", OWNER_TENANT_ID, "raj", HOST_A);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); fetchSpy.mockRestore(); });

describe("guild helpers", () => {
  it("validates", () => {
    expect(isGuildId("123456789")).toBe(true); expect(isGuildId("12ab")).toBe(false); expect(isGuildId("1234")).toBe(false);
    expect(creditsOfPlan("5 Tokens")).toBe(5); expect(creditsOfPlan("Token")).toBe(0); expect(creditsOfPlan("500 Tokens")).toBe(0);
    expect(isTokenCode(makeTokenCode())).toBe(true); expect(isTokenCode("GG-1")).toBe(false);
  });
});

describe("buy token", () => {
  it("charges the server price, creates one token worth the plan, saves history", async () => {
    const res = await doBuy("5 Tokens"); const j = await res.json();
    expect(res.status).toBe(200); expect(j.credits).toBe(5); expect(isTokenCode(j.code)).toBe(true);
    expect(bal("raj")).toBe(700); expect(bal(`ggt:${j.code}`)).toBe(5);
    expect(tables.purchase_history.at(-1)).toMatchObject({ username: "raj", key_code: j.code, price_paid: "300" });
  });
  it("rejects bad plans, non-guild products, maintenance, low balance and co-admin stores; no money moves", async () => {
    expect((await doBuy("Token")).status).toBe(400);
    expect((await doBuy("1 Token", "Nope")).status).toBe(404);
    seed("products_catalog", [{ ...product(""), product_id: "plain", name: "Plain" }]);
    expect((await doBuy("1 Token", "Plain")).status).toBe(404);
    row("raj")!.balance = 10; expect((await doBuy()).status).toBe(400); row("raj")!.balance = 1000;
    seed("product_prices", [{ tenant_id: OWNER_TENANT_ID, product_name: "Guild Glory Booster", duration: "__status__", price_inr: 1 }]);
    expect((await doBuy()).status).toBe(409);
    expect(bal("raj")).toBe(1000);
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    expect((await post(buy, "/api/guild/buy", { product_name: "Guild Glory Booster", duration: "1 Token" }, HOST_B)).status).toBe(403);
    ctx.cookie = ""; expect((await doBuy()).status).toBe(401);
  });
});

describe("redeem token", () => {
  it("turns a token into credits once; a second try fails", async () => {
    const { code } = await (await doBuy("5 Tokens")).json();
    const r = await doRedeem(code.toLowerCase()); const j = await r.json();
    expect(r.status).toBe(200); expect(j).toMatchObject({ added: 5, credits: 5 });
    expect(bal("gg:raj")).toBe(5); expect(bal(`ggt:${code}`)).toBe(0);
    const again = await doRedeem(code); expect(again.status).toBe(400); expect(bal("gg:raj")).toBe(5);
  });
  it("another user can redeem a shared token, but only one of them gets it", async () => {
    const { code } = await (await doBuy("1 Token")).json();
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    expect((await doRedeem(code)).status).toBe(200); expect(bal("gg:boss")).toBe(1);
    loginAs("rajA", OWNER_TENANT_ID, "raj", HOST_A);
    expect((await doRedeem(code)).status).toBe(400); expect(bal("gg:raj")).toBe(0);
  });
  it("rejects malformed and unknown tokens", async () => {
    expect((await doRedeem("hello")).status).toBe(400);
    expect((await doRedeem("GG-AAAA-BBBB-CCCC-DDDD")).status).toBe(400);
  });
});

describe("launch group", () => {
  beforeEach(() => { tables.wallets.push({ id: "c1", tenant_id: OWNER_TENANT_ID, username: "gg:raj", balance: 2 }); });
  it("spends one credit, calls the seller with key + idempotency, remembers the group", async () => {
    const r = await doLaunch(); const j = await r.json();
    expect(r.status).toBe(200); expect(j).toMatchObject({ success: true, ref: "G-1", credits: 1 });
    const call = fetchSpy.mock.calls.find((c: any) => String(c[0]).endsWith("/groups") && c[1]?.method === "POST") as any;
    expect(call[0]).toBe("https://seller.example/api/v1/groups");
    expect(call[1].headers.Authorization).toBe("Bearer secret-key");
    expect(call[1].headers["Idempotency-Key"]).toMatch(/^jp-/);
    expect(JSON.parse(call[1].body)).toEqual({ region: "in", clan_id: "123456789" });
    expect(bal("gg:raj")).toBe(1);
  });
  it("seller failure returns the credit", async () => {
    groupsReply = () => json({ ok: false, error: { code: "x", message: "no capacity" } }, 500);
    const r = await doLaunch(); expect(r.status).toBe(502); expect(bal("gg:raj")).toBe(2);
  });
  it("seller 402 / bad json also return the credit", async () => {
    groupsReply = () => json({ ok: false, error: { message: "insufficient credits" } }, 402);
    expect((await doLaunch()).status).toBe(502); expect(bal("gg:raj")).toBe(2);
    groupsReply = () => new Response("<html>", { status: 200 });
    expect((await doLaunch()).status).toBe(502); expect(bal("gg:raj")).toBe(2);
  });
  it("blocks bad input, unavailable/maintenance regions, no credits and maintenance", async () => {
    for (const b of [{ guild_id: "abc" }, { guild_id: "12" }, { region: "" }, { region: "sg" }, { region: "br" }, { region: "zz" }, { product_name: "Nope" }])
      { vi.setSystemTime(Date.now() + 70_000); expect([400, 404]).toContain((await doLaunch(b)).status); }
    expect(bal("gg:raj")).toBe(2);
    vi.setSystemTime(Date.now() + 70_000);
    row("gg:raj")!.balance = 0; expect((await doLaunch()).status).toBe(400);
    row("gg:raj")!.balance = 2;
    seed("product_prices", [{ tenant_id: OWNER_TENANT_ID, product_name: "Guild Glory Booster", duration: "__status__", price_inr: 1 }]);
    expect((await doLaunch()).status).toBe(409); expect(bal("gg:raj")).toBe(2);
  });
  it("not connected: nothing is spent", async () => {
    vi.stubEnv("GUILD_API_URL", "");
    const r = await doLaunch(); expect(r.status).toBe(502); expect(bal("gg:raj")).toBe(2); expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("closed to co-admin stores", async () => {
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    expect((await post(launch, "/api/guild/launch", { product_name: "x", region: "in", guild_id: "123456789" }, HOST_B)).status).toBe(403);
  });
});

describe("me + catalog", () => {
  it("shows credits, only available regions, and the customer's groups with live status", async () => {
    tables.wallets.push({ id: "c1", tenant_id: OWNER_TENANT_ID, username: "gg:raj", balance: 3 });
    await doLaunch();
    const j = await (await me(req("/api/guild/me", { host: HOST_A }))).json();
    expect(j.credits).toBe(2); expect(j.connected).toBe(true);
    expect(j.regions.map((r: any) => r.id)).toEqual(["in"]);
    expect(j.groups[0]).toMatchObject({ clan: "123456789", status: "running" });
  });
  it("a failed/refunded group gives the credit back exactly once", async () => {
    tables.wallets.push({ id: "c1", tenant_id: OWNER_TENANT_ID, username: "gg:raj", balance: 1 });
    await doLaunch(); expect(bal("gg:raj")).toBe(0);
    fetchSpy.mockImplementation((async (url: any) => {
      const u = String(url);
      if (u.endsWith("/regions")) return json({ data: [] });
      return json({ ok: true, data: [{ group_id: "G-1", clan_id: "123456789", region: "in", status: "failed" }] });
    }) as any);
    await me(req("/api/guild/me", { host: HOST_A })); expect(bal("gg:raj")).toBe(1);
    await me(req("/api/guild/me", { host: HOST_A })); expect(bal("gg:raj")).toBe(1);
  });
  it("public catalog marks it as guild and applies the live maintenance switch", async () => {
    seed("product_prices", [{ tenant_id: OWNER_TENANT_ID, product_name: "Guild Glory Booster", duration: "__status__", price_inr: 1 }]);
    const j = await (await publicCatalog()).json();
    expect(j.products.find((x: any) => x.name === "Guild Glory Booster")).toMatchObject({ kind: "guild", category: "others", status: "MAINTENANCE" });
    expect(JSON.stringify(j)).not.toContain("supplier");
  });
});
