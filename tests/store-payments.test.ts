import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, req } from "./helpers/env";

vi.mock("next/headers", async () => (await import("./helpers/env")).nextHeadersMock());
vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));

import { tables, seed } from "./helpers/fake-supabase";
import { buildWorld, loginAs, HOST_A, HOST_B, TENANT_B } from "./helpers/world";
import { OWNER_TENANT_ID } from "@/lib/tenant";
import { invalidateGatewayCache } from "@/lib/payment-gateway";
import { sendTelegramPurchase } from "@/lib/telegram";
import { GET as gwGet, POST as gwPost } from "@/app/api/admin/gateway/route";
import { POST as walletOrder } from "@/app/api/create-wallet-order/route";
import { GET as tgGet, POST as tgPost } from "@/app/api/admin/store-telegram/route";

const fetched: string[] = [];
beforeEach(() => {
  buildWorld(); invalidateGatewayCache(); fetched.length = 0;
  vi.unstubAllEnvs(); vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("ANUJ_API_KEY", "OWNER-ENV-KEY-123456");
  vi.stubGlobal("fetch", async (url: string, init?: any) => {
    fetched.push(String(url));
    if (String(url).includes("api.telegram.org")) return { ok: true, status: 200, json: async () => ({ ok: true }), text: async () => "{}" };
    const body = { status: "success", data: { order_id: "ORD1", qr_url: "https://q/x.png", amount: "100.00", upi_id: "a@b", valid_seconds: 300 } };
    return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
  });
});
const store = () => loginAs("coadminB", TENANT_B, "andrew", HOST_B);
const gw = (host: string, body: any) => gwPost(req("/api/admin/gateway", { host, method: "POST", body }));
const topup = (host: string) => walletOrder(req("/api/create-wallet-order", { host, method: "POST", body: { amount: 100, mobile_number: "9999999999" } }));

describe("co-admin store payments", () => {
  it("without its own key the store cannot take payments (and never uses the owner's env key)", async () => {
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    expect((await topup(HOST_B)).status).toBe(503);
    expect(fetched.length).toBe(0);
  });
  it("store admin saves its own ANUJ key; top-up uses THAT key, not the owner's", async () => {
    store();
    expect((await gw(HOST_B, { action: "save_config", gateway: "anuj", apiKey: "STORE-B-KEY-98765432" })).status).toBe(200);
    expect((await gw(HOST_B, { action: "set_active", gateway: "anuj" })).status).toBe(200);
    // stored under the store's own prefixed keys; owner rows untouched
    const keys = (tables.app_settings ?? []).map((r) => r.key);
    expect(keys.every((k) => k.startsWith(`t:${TENANT_B}:`))).toBe(true);
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    const r = await topup(HOST_B);
    expect(r.status).toBe(200);
    const call = fetched.find((u) => u.includes("autoqr"))!;
    expect(call).toContain("STORE-B-KEY-98765432");
    expect(call).not.toContain("OWNER-ENV-KEY");
    expect((tables.deposit_history ?? [])[0]).toMatchObject({ tenant_id: TENANT_B, gateway: "anuj" });
  });
  it("XYZ is not available to a store; the view never shows keys or the owner's settings", async () => {
    store();
    expect((await gw(HOST_B, { action: "save_config", gateway: "xyz", apiKey: "XYZ-KEY-12345678" })).status).toBe(400);
    expect((await gw(HOST_B, { action: "set_active", gateway: "xyz" })).status).toBe(500);
    await gw(HOST_B, { action: "save_config", gateway: "paytm", apiKey: "PAYTM-B-KEY-1234567" });
    const text = await (await gwGet(req("/api/admin/gateway", { host: HOST_B }))).text();
    expect(text).not.toMatch(/PAYTM-B-KEY|OWNER-ENV|XYZ-KEY/);
    const j = JSON.parse(text);
    expect(Object.keys(j.gateways).sort()).toEqual(["anuj", "paytm"]);
    expect(j.gateways.anuj.keySource).toBe("missing"); // env key of the owner is NOT inherited
  });
  it("customers and anonymous users cannot touch gateway settings; the owner's settings are not reachable from a store", async () => {
    ctx.cookie = ""; expect((await gwGet(req("/api/admin/gateway", { host: HOST_B }))).status).toBe(401);
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    expect((await gw(HOST_B, { action: "save_config", gateway: "anuj", apiKey: "X-KEY-12345678" })).status).toBe(403);
    // owner saves; store view is unaffected
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    await gw(HOST_A, { action: "save_config", gateway: "anuj", apiKey: "OWNER-SAVED-KEY-12345" });
    store();
    const j = await (await gwGet(req("/api/admin/gateway", { host: HOST_B }))).json();
    expect(j.gateways.anuj.keySource).toBe("missing");
  });
});

describe("co-admin store Telegram", () => {
  it("saves privately, tests, and purchase alerts go to the STORE bot only", async () => {
    store();
    const save = await tgPost(req("/api/admin/store-telegram", { host: HOST_B, method: "POST", body: { botToken: "123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", chatId: "-1001234567890", enabled: true, keyMode: "masked" } }));
    expect(save.status).toBe(200);
    expect((await tgPost(req("/api/admin/store-telegram", { host: HOST_B, method: "POST", body: { botToken: "bad token" } }))).status).toBe(400);
    const view = await (await tgGet(req("/api/admin/store-telegram", { host: HOST_B }))).text();
    expect(view).not.toContain("AAAAAAAA"); expect(view).toContain("hasToken");
    await sendTelegramPurchase({ username: "cust", product: "P", duration: "1 day", amount: 50, key: "SECRETKEY123", tenantId: TENANT_B });
    const tgCalls = fetched.filter((u) => u.includes("api.telegram.org"));
    expect(tgCalls).toHaveLength(1);
    expect(tgCalls[0]).toContain("bot123456789:");
  });
  it("hidden key mode never sends the key; a store without Telegram sends nothing; owner route refuses the owner", async () => {
    const sent: any[] = [];
    vi.stubGlobal("fetch", async (u: string, init: any) => { sent.push({ u, body: init?.body }); return { ok: true, status: 200, json: async () => ({ ok: true }) }; });
    await sendTelegramPurchase({ username: "c", product: "P", duration: "d", amount: 1, key: "K1", tenantId: TENANT_B });
    expect(sent).toHaveLength(0);
    store();
    await tgPost(req("/api/admin/store-telegram", { host: HOST_B, method: "POST", body: { botToken: "123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", chatId: "555555", enabled: true, keyMode: "hidden" } }));
    await sendTelegramPurchase({ username: "c", product: "P", duration: "d", amount: 1, key: "SUPERSECRET", tenantId: TENANT_B });
    expect(sent).toHaveLength(1); expect(String(sent[0].body)).not.toContain("SUPERSECRET");
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    expect((await tgGet(req("/api/admin/store-telegram", { host: HOST_A }))).status).toBe(403);
  });
});
