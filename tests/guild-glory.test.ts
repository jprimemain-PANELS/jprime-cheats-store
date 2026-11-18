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
import { GET as groupGet, POST as groupPost } from "@/app/api/guild/group/route";
import { GET as me } from "@/app/api/guild/me/route";
import { GET as publicCatalog } from "@/app/api/catalog/route";
import { bindGroups, creditsOfPlan, flattenRows, isGuildId, isTokenCode, makeTokenCode, normalizeGroup } from "@/lib/guild-glory";
import { readSetting, writeSetting } from "@/lib/tenant-db";

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
    if (u.endsWith("/groups/G-1")) return json({ ok: true, data: { group_id: "G-1", clan_id: "123456789", region: "in", status: "running", bots: 4, uptime_seconds: 5400, secret_internal: "x" } });
    if (u.endsWith("/groups/G-1/clan")) return json({ ok: true, data: { clan_name: "DHOLAKPUR", level: 7, members: "42/55", captain: "1630862612", total_glory: 12345 } });
    if (u.endsWith("/groups/G-1/glory")) return json({ ok: true, data: { glory: 80, goal_percent: 40 } });
    if (u.endsWith("/groups/G-1/history")) return json({ ok: true, data: [{ result: "win", glory: 12, api_key: "SECRET", nested: { a: 1 } }] });
    if (u.endsWith("/groups/G-1/players")) return json({ ok: true, data: { players: [{ uid: "111", name: "Bot1", token: "T" }] } });
    if (u.endsWith("/groups/G-1") && init?.method === "DELETE") return json({ ok: true, data: {} });
    if (u.endsWith("/groups/G-1/actions") && init?.method === "POST") return json({ ok: true, data: {} });
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


describe("live group panel", () => {
  const getG = (ref = "G-1", q = "") => groupGet(req(`/api/guild/group?ref=${ref}${q}`, { host: HOST_A }));
  beforeEach(async () => { tables.wallets.push({ id: "c1", tenant_id: OWNER_TENANT_ID, username: "gg:raj", balance: 2 }); await doLaunch(); });
  it("normalizes the seller replies and hides unknown fields as null", () => {
    expect(normalizeGroup("G", [{ data: { name: "A", level: "3" } }, null as any])).toMatchObject({ name: "A", level: 3, members: null, totalGlory: null, goalPercent: null });
  });
  it("shows name, members, captain, glory, bots, uptime and goal for the customer's own group", async () => {
    const j = await (await getG()).json();
    expect(j.group).toMatchObject({ groupId: "G-1", name: "DHOLAKPUR", level: 7, members: 42, maxMembers: 55, captain: "1630862612", totalGlory: 12345, groupGlory: 80, bots: 4, uptime: "1h 30m", goalPercent: 40 });
    expect(JSON.stringify(j)).not.toContain("secret_internal"); expect(j.raw).toBeUndefined();
  });
  it("only the owner of the group can see it or control it", async () => {
    expect((await getG("G-999")).status).toBe(404);
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    expect((await getG()).status).toBe(404);
    expect((await post(groupPost, "/api/guild/group", { ref: "G-1", action: "stop" })).status).toBe(404);
    expect(fetchSpy.mock.calls.some((c: any) => String(c[0]).endsWith("/actions"))).toBe(false);
  });
  it("restart / stop go to the seller; other actions are refused", async () => {
    expect((await post(groupPost, "/api/guild/group", { ref: "G-1", action: "restart" })).status).toBe(200);
    const c = fetchSpy.mock.calls.find((x: any) => String(x[0]).endsWith("/groups/G-1/actions")) as any;
    expect(JSON.parse(c[1].body)).toEqual({ action: "restart" });
    expect((await post(groupPost, "/api/guild/group", { ref: "G-1", action: "explode" })).status).toBe(400);
  });
  it("closed to co-admin stores", async () => {
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    expect((await groupGet(req("/api/guild/group?ref=G-1", { host: HOST_B }))).status).toBe(403);
  });
});

describe("stable group pairing + extra options", () => {
  const saved = async () => ((await readSetting(OWNER_TENANT_ID, "guildgroups:raj")).data?.value ?? []) as any[];
  beforeEach(async () => { tables.wallets.push({ id: "c1", tenant_id: OWNER_TENANT_ID, username: "gg:raj", balance: 5 }); await doLaunch(); });

  it("name is read from the clan reply, never from a generic name in the group reply", () => {
    expect(normalizeGroup("G", [{ data: { name: "jp-internal-label" } }, { data: { clan_name: "DHOLAKPUR" } }]).name).toBe("DHOLAKPUR");
  });
  it("remembers the seller group id and the guild name; the name survives a failed lookup", async () => {
    await getG(); await getG();
    expect((await saved())[0]).toMatchObject({ gid: "G-1", name: "DHOLAKPUR" });
    fetchSpy.mockImplementation((async (url: any) => (String(url).endsWith("/regions") ? json({ data: [] }) : json({ ok: false }, 500))) as any);
    const j = await (await me(req("/api/guild/me", { host: HOST_A }))).json();
    expect(j.groups[0]).toMatchObject({ name: "DHOLAKPUR", ended: false });
    expect(j.groups[0].status).not.toBe("ended");
  });
  function getG(ref = "G-1") { return groupGet(req(`/api/guild/group?ref=${ref}`, { host: HOST_A })); }

  it("two groups for the same Guild ID are paired by creation time and each keeps its own id", () => {
    const t0 = Date.parse("2026-11-18T04:00:00Z"), t1 = Date.parse("2026-11-18T04:25:00Z");
    const recs: any[] = [{ ref: "jp-old", clan: "3048506227", region: "in", regionName: "India", at: new Date(t0).toISOString() }, { ref: "jp-new", clan: "3048506227", region: "in", regionName: "India", at: new Date(t1).toISOString() }];
    bindGroups(recs, [{ group_id: "S-NEW", clan_id: "3048506227", region: "IN", status: "running", created: t1 + 20_000 }]);
    expect(recs[0].gid).toBeUndefined(); expect(recs[1].gid).toBe("S-NEW");
    expect(bindGroups(recs, [{ group_id: "S-NEW", clan_id: "3048506227", region: "IN", status: "running", created: t1 }])).toBe(false);
  });
  it("a group the service no longer lists is shown as ended after 10 minutes, with no controls reachable", async () => {
    const list = await saved(); list[0] = { ...list[0], ref: "jp-gone", gid: undefined, at: new Date(Date.now() - 20 * 60_000).toISOString(), clan: "555555555" };
    await writeSetting(OWNER_TENANT_ID, "guildgroups:raj", list);
    const j = await (await me(req("/api/guild/me", { host: HOST_A }))).json();
    expect(j.groups[0]).toMatchObject({ status: "ended", ended: true });
    expect((await getG("jp-gone")).status).toBe(409);
  });
  it("match history and players are reduced to plain rows (no secrets, no nested objects)", async () => {
    const h = await (await groupGet(req("/api/guild/group?ref=G-1&view=history", { host: HOST_A }))).json();
    expect(h.rows).toEqual([{ result: "win", glory: 12 }]);
    const p = await (await groupGet(req("/api/guild/group?ref=G-1&view=players", { host: HOST_A }))).json();
    expect(p.rows).toEqual([{ uid: "111", name: "Bot1" }]);
    expect(flattenRows({ data: "x" })).toEqual([]);
  });
  it("refresh maps to the seller's refresh-all; delete removes it from the list; refund is a one-time admin request", async () => {
    await post(groupPost, "/api/guild/group", { ref: "G-1", action: "refresh" });
    const c = fetchSpy.mock.calls.find((x: any) => String(x[0]).endsWith("/groups/G-1/actions")) as any;
    expect(JSON.parse(c[1].body)).toEqual({ action: "refresh-all" });
    const a = await (await post(groupPost, "/api/guild/group", { ref: "G-1", action: "refund" })).json();
    expect(a.message).toMatch(/sent/i); expect(bal("gg:raj")).toBe(4);
    expect((await (await post(groupPost, "/api/guild/group", { ref: "G-1", action: "refund" })).json()).message).toMatch(/already/i);
    expect(tables.audit_log.filter((r: any) => r.action === "guild.refund_requested")).toHaveLength(1);
    const d = await (await post(groupPost, "/api/guild/group", { ref: "G-1", action: "delete" })).json();
    expect(d.removed).toBe(true); expect(await saved()).toHaveLength(0);
  });
});
