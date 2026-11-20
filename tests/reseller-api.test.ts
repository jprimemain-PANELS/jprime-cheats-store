import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, req } from "./helpers/env";

vi.mock("next/headers", async () => (await import("./helpers/env")).nextHeadersMock());
vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));
vi.mock("@/lib/telegram", () => ({ sendTelegramPurchase: async () => {} }));

import { tables, seed } from "./helpers/fake-supabase";
import { buildWorld, loginAs, HOST_A, HOST_B, TENANT_B } from "./helpers/world";
import { OWNER_TENANT_ID } from "@/lib/tenant";
import { GET as panelGet, POST as panelPost } from "@/app/api/reseller/panel/route";
import { GET as v1Get, POST as v1Post } from "@/app/api/reseller/v1/[...path]/route";
import { GET as compatGet, POST as compatPost } from "@/app/api/reseller/compat/[kind]/route";

const prm = (path: string[]) => ({ params: Promise.resolve({ path }) });
const kprm = (kind: string) => ({ params: Promise.resolve({ kind }) });

beforeEach(() => {
  buildWorld();
  tables.products_catalog = []; tables.stock_keys = []; tables.purchase_history = []; tables.reseller_price_overrides = [];
  seed("products_catalog", [{ tenant_id: OWNER_TENANT_ID, product_id: "pubg-x", name: "PUBG X", data: { id: "pubg-x", name: "PUBG X", status: "ONLINE", category: "mobile", prices: [{ duration: "1 day", priceINR: "100", resellerPrice: "70", supplier: "LOCAL" }, { duration: "7 days", priceINR: "400", resellerPrice: "300", supplier: "LOCAL" }] } }]);
  seed("stock_keys", [
    { tenant_id: OWNER_TENANT_ID, product_name: "PUBG X", duration: "1 day", key_code: "KEY-ONE", is_used: false },
    { tenant_id: OWNER_TENANT_ID, product_name: "PUBG X", duration: "1 day", key_code: "KEY-TWO", is_used: false },
  ]);
  seed("users", [{ id: "u-res", tenant_id: OWNER_TENANT_ID, username: "reseller1", role: "reseller", password: "x", email: "r@x.test", mobile_number: "9999999999" }, { id: "u-resB", tenant_id: TENANT_B, username: "reseller1", role: "reseller", password: "x", email: "rb@x.test", mobile_number: "9999999999" }]);
  seed("wallets", [{ tenant_id: OWNER_TENANT_ID, username: "reseller1", balance: 150 }]);
});

async function makeKey(userKey = "rajA", host = HOST_A) {
  // promote raj to reseller session-wise by logging in as the seeded reseller instead
  ctx.host = host; ctx.cookie = "";
  const { createSessionToken } = await import("@/lib/auth");
  ctx.cookie = createSessionToken("reseller1", "x", "u-res", OWNER_TENANT_ID);
  const r = await panelPost(req("/api/reseller/panel", { method: "POST", body: { action: "generate" }, host }));
  return (await r.json()).key as string;
}
const auth = (key: string, extra: Record<string, string> = {}) => ({ authorization: `Bearer ${key}`, ...extra });

describe("reseller API", () => {
  it("only resellers can use the API tab; keys are shown once and stored hashed", async () => {
    loginAs("rajA", OWNER_TENANT_ID, "raj", HOST_A);
    expect((await panelPost(req("/api/reseller/panel", { method: "POST", body: { action: "generate" } }))).status).toBe(403);
    const key = await makeKey();
    expect(key).toMatch(/^rk_[a-f0-9]{48}$/);
    expect(JSON.stringify(tables.app_settings)).not.toContain(key);
    const info = await (await panelGet(req("/api/reseller/panel"))).json();
    expect(info.key.hasKey).toBe(true);
    expect(JSON.stringify(info)).not.toContain(key);
    expect(info.items.map((i: any) => i.product_id)).toEqual([1001, 1002]);
    expect(info.items[0]).toMatchObject({ product: "PUBG X", duration: "1 day", price: 70, stock: 2, in_stock: true });
    expect(info.items[1]).toMatchObject({ price: 300, stock: 0, in_stock: false });
  });

  it("rejects missing / wrong / other-store keys and non-resellers", async () => {
    const key = await makeKey();
    ctx.cookie = "";
    expect((await v1Get(req("/api/reseller/v1/balance"), prm(["balance"]))).status).toBe(401);
    expect((await v1Get(req("/api/reseller/v1/balance", { headers: auth("rk_" + "0".repeat(48)) }), prm(["balance"]))).status).toBe(401);
    expect((await v1Get(req("/api/reseller/v1/balance", { host: HOST_B, headers: auth(key) }), prm(["balance"]))).status).toBe(401); // key of store A on store B
    const ok = await v1Get(req("/api/reseller/v1/balance", { host: HOST_A, headers: auth(key) }), prm(["balance"]));
    expect((await ok.json()).balance).toBe(150);
    tables.users.find((u) => u.id === "u-res")!.role = "user"; // downgraded -> key stops working
    expect((await v1Get(req("/api/reseller/v1/balance", { headers: auth(key) }), prm(["balance"]))).status).toBe(401);
  });

  it("buy: charges the reseller price, delivers a key, records history; idempotent retry never double-charges", async () => {
    const key = await makeKey(); ctx.cookie = "";
    const buy = (idem?: string) => v1Post(req("/api/reseller/v1/buy", { method: "POST", headers: auth(key), body: { product_id: 1001, ...(idem ? { idempotency_key: idem } : {}) } }), prm(["buy"]));
    const r = await buy("order-0001");
    expect(r.status).toBe(201);
    const j = await r.json();
    expect(j).toMatchObject({ success: true, price: 70, balance: 80 }); const first = j.key; expect(["KEY-ONE", "KEY-TWO"]).toContain(first);
    expect(tables.purchase_history).toHaveLength(1);
    const again = await (await buy("order-0001")).json();
    expect(again).toMatchObject({ success: true, duplicate: true, key: first, balance: 80 });
    expect(tables.stock_keys.filter((k) => k.is_used).length).toBe(1);
    const r2 = await buy("order-0002"); expect((await r2.json()).key).not.toBe(first);
    const r3 = await buy("order-0003"); // wallet 10 left, out of stock for 1001 anyway
    expect(r3.status).toBe(409);
  });

  it("insufficient wallet -> 402 and nothing is taken; unknown / out-of-stock product handled", async () => {
    const key = await makeKey(); ctx.cookie = "";
    tables.wallets.find((w) => w.username === "reseller1")!.balance = 20;
    const r = await v1Post(req("/api/reseller/v1/buy", { method: "POST", headers: auth(key), body: { product_id: 1001 } }), prm(["buy"]));
    expect(r.status).toBe(402);
    expect(tables.wallets.find((w) => w.username === "reseller1")!.balance).toBe(20);
    expect((await v1Post(req("/api/reseller/v1/buy", { method: "POST", headers: auth(key), body: { product_id: 9999 } }), prm(["buy"]))).status).toBe(404);
    expect((await v1Post(req("/api/reseller/v1/buy", { method: "POST", headers: auth(key), body: { product_id: "abc" } }), prm(["buy"]))).status).toBe(400);
  });

  it("the three compatibility styles answer in their own shapes", async () => {
    const key = await makeKey(); ctx.cookie = "";
    const form = (o: Record<string, string>) => new URLSearchParams(o).toString();
    const raw = (path: string, body: string, headers: Record<string, string>) => new (require("next/server").NextRequest)(`https://${HOST_A}${path}`, { method: "POST", headers: { host: HOST_A, ...headers }, body });
    const s1 = await (await compatPost(raw("/api/reseller/compat/s1", form({ api_key: key, action: "buy", product_id: "1001" }), { "content-type": "application/x-www-form-urlencoded" }), kprm("s1"))).json();
    expect(s1.status).toBe("success"); expect(["KEY-ONE", "KEY-TWO"]).toContain(s1.data.key);
    const s2 = await (await compatPost(raw("/api/reseller/compat/s2", form({ variant_id: "1001", quantity: "1" }), { "content-type": "application/x-www-form-urlencoded", "x-api-token": key }), kprm("s2"))).json();
    expect(s2.success).toBe(true); expect(s2.keys[0]).not.toBe(s1.data.key); expect(["KEY-ONE", "KEY-TWO"]).toContain(s2.keys[0]);
    const bad = await compatPost(raw("/api/reseller/compat/s3", JSON.stringify({ product_id: 1001, quantity: 1 }), { "content-type": "application/json", authorization: "Bearer nope" }), kprm("s3"));
    expect(bad.status).toBe(401); expect(await bad.json()).toMatchObject({ ok: false, error: { message: "Invalid API key." } });
    tables.wallets.find((w) => w.username === "reseller1")!.balance = 500;
    const s3 = await (await compatPost(raw("/api/reseller/compat/s3", JSON.stringify({ product_id: 1002, quantity: 1 }), { "content-type": "application/json", authorization: `Bearer ${key}` }), kprm("s3"))).json();
    expect(s3.ok).toBe(false); // 7 days has no stock
    const bal = await (await compatGet(new (require("next/server").NextRequest)(`https://${HOST_A}/api/reseller/compat/s1?action=balance&api_key=${key}`, { headers: { host: HOST_A } }), kprm("s1"))).json();
    expect(bal).toMatchObject({ status: "success" });
  });
});
