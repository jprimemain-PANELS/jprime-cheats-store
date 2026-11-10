import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctx } from "./helpers/env";

vi.mock("next/headers", async () => (await import("./helpers/env")).nextHeadersMock());
vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));
vi.mock("@/lib/telegram", () => ({ sendTelegramPurchase: async () => {} }));

import { tables, seed } from "./helpers/fake-supabase";
import { buildWorld, TENANT_B, TENANT_C } from "./helpers/world";
import { OWNER_TENANT_ID } from "@/lib/tenant";
import { releaseProduct, LOW_CREDIT_MESSAGE } from "@/lib/release-product";

const S1 = "https://bantibhaiya.to/api/reseller_v1.php";
const S2 = "https://whitexmodz.store/api/v1/generate_key.php";
let calls: { url: string; headers: any; body: string }[] = [];
let sellerOk = true;

const OWNER_TIERS = [
  { duration: "1 day", priceINR: "40", resellerPrice: "28", supplier: "SELLER1", seller1Pid: "P1", seller1Duration: "1" },
  { duration: "7 days", priceINR: "120", resellerPrice: "90", supplier: "SELLER2", seller2VariantId: "V9" },
  { duration: "30 days", priceINR: "300", resellerPrice: "250", supplier: "LOCAL" },
];
const bTier = (o: any = {}) => ({ duration: "1 Day", priceINR: "60", resellerPrice: "45", supplier: "JPRIME", jprimeProductId: "pubg-x", jprimeDuration: "1 day", ...o });
const wallet = (u: string, t = OWNER_TENANT_ID) => Number((tables.wallets.find((w) => w.username === u && w.tenant_id === t) as any)?.balance ?? 0);
const release = (name = "Raj PUBG", duration = "1 Day", tenantId = TENANT_B) => releaseProduct({ tenantId, username: "cust", product_name: name, duration }) as Promise<any>;

beforeEach(() => {
  buildWorld();
  vi.unstubAllEnvs();
  vi.stubEnv("RESELLER_API_KEY", "OWNER-S1-KEY"); vi.stubEnv("RESELLER_MASTER_KEY", "OWNER-MASTER"); vi.stubEnv("SELLER2_API_TOKEN", "OWNER-S2-TOKEN");
  calls = []; sellerOk = true;
  vi.stubGlobal("fetch", async (url: any, init: any) => {
    calls.push({ url: String(url), headers: init?.headers ?? {}, body: String(init?.body ?? "") });
    if (!sellerOk) return new Response(JSON.stringify({ status: "error", success: false, msg: "SECRET SELLER ERROR" }), { status: 200 });
    return new Response(JSON.stringify(String(url).includes("bantibhaiya") ? { status: "success", data: { key: "S1-KEY" } } : { success: true, keys: ["S2-KEY"] }), { status: 200 });
  });
  tables.products_catalog = [];
  seed("products_catalog", [
    { tenant_id: OWNER_TENANT_ID, product_id: "pubg-x", name: "PUBG X", data: { id: "pubg-x", name: "PUBG X", status: "ONLINE", prices: OWNER_TIERS } },
    { tenant_id: TENANT_B, product_id: "raj-pubg", name: "Raj PUBG", data: { id: "raj-pubg", name: "Raj PUBG", prices: [bTier(), bTier({ duration: "7 Days", jprimeDuration: "7 days" }), bTier({ duration: "Gone", jprimeDuration: "9 days" })] } },
  ]);
  const t = tables.tenants.find((x) => x.id === TENANT_B) as any;
  t.shared_stock_allowed = true; t.payer_username = "rajreseller";
  tables.wallets = [];
  seed("wallets", [{ tenant_id: OWNER_TENANT_ID, username: "rajreseller", balance: 100 }]);
  tables.tenant_api_connections = [];
});

describe("JPRIME API stock (co-admin sells the owner's API product)", () => {
  it("success: the OWNER's reseller price is taken from the store wallet, key delivered, ledger written", async () => {
    const r = await release();
    expect(r).toMatchObject({ success: true, key: "S1-KEY" });
    expect(wallet("rajreseller")).toBe(72); // 100 - 28
    expect(calls).toHaveLength(1); expect(calls[0].url).toBe(S1);
    expect(calls[0].body).toContain("OWNER-S1-KEY"); // owner's integration does the buying
    expect((tables.wallet_transactions ?? []).filter((x) => x.type === "debit" && x.amount === 28)).toHaveLength(1);
  });
  it("works through the second seller too (7 days costs 90)", async () => {
    const r = await release("Raj PUBG", "7 Days");
    expect(r).toMatchObject({ success: true, key: "S2-KEY" }); expect(calls[0].url).toBe(S2); expect(wallet("rajreseller")).toBe(10);
  });
  it("low credit: nothing is bought, nothing charged, customer sees 'out of stock'", async () => {
    tables.wallets = []; seed("wallets", [{ tenant_id: OWNER_TENANT_ID, username: "rajreseller", balance: 10 }]);
    const r = await release();
    expect(r).toEqual({ success: false, error: LOW_CREDIT_MESSAGE });
    expect(LOW_CREDIT_MESSAGE).toMatch(/out of stock/i);
    expect(calls).toHaveLength(0); expect(wallet("rajreseller")).toBe(10);
  });
  it("two sales at once with money for only one: exactly one succeeds", async () => {
    tables.wallets = []; seed("wallets", [{ tenant_id: OWNER_TENANT_ID, username: "rajreseller", balance: 30 }]);
    const [a, b] = await Promise.all([release(), release()]);
    expect([a.success, b.success].filter(Boolean)).toHaveLength(1);
    expect(wallet("rajreseller")).toBe(2); expect(calls).toHaveLength(1);
  });
  it("seller failure: the credit is refunded exactly once and no seller text reaches the customer", async () => {
    sellerOk = false;
    const r = await release();
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).not.toMatch(/SECRET|seller|bb team|whitex/i);
    expect(wallet("rajreseller")).toBe(100);
    expect((tables.wallet_transactions ?? []).filter((x) => x.type === "refund")).toHaveLength(1);
  });
  it("refused with no charge when: shared stock is off, no wallet user is linked, or the owner product is gone/maintenance/not an API tier", async () => {
    const t = tables.tenants.find((x) => x.id === TENANT_B) as any;
    t.shared_stock_allowed = false; expect(await release()).toMatchObject({ success: true }); // no owner switch needed: the linked wallet is enough
    tables.wallets = []; seed("wallets", [{ tenant_id: OWNER_TENANT_ID, username: "rajreseller", balance: 100 }]); calls = [];
    t.payer_username = null; expect(await release()).toMatchObject({ success: false });
    t.payer_username = "rajreseller";
    expect(await release("Raj PUBG", "Gone")).toMatchObject({ success: false, error: "This product is not available right now." });
    (tables.products_catalog[0] as any).data.status = "MAINTENANCE";
    expect(await release()).toMatchObject({ success: false, error: "This product is not available right now." });
    (tables.products_catalog[0] as any).data.status = "ONLINE";
    (tables.products_catalog[1] as any).data.prices[0].jprimeDuration = "30 days"; // owner LOCAL tier is not API stock
    expect(await release()).toMatchObject({ success: false });
    expect(calls).toHaveLength(0); expect(wallet("rajreseller")).toBe(100);
  });
  it("a store can only ever charge ITS OWN wallet user", async () => {
    seed("wallets", [{ tenant_id: OWNER_TENANT_ID, username: "someoneelse", balance: 500 }]);
    (tables.products_catalog[1] as any).data.prices[0].payer = "someoneelse"; // a forged field in the tier is ignored
    await release();
    expect(wallet("someoneelse")).toBe(500);
  });
  it("the owner store can never use the JPRIME route", async () => {
    seed("products_catalog", [{ tenant_id: OWNER_TENANT_ID, product_id: "x", name: "Loop", data: { id: "x", name: "Loop", prices: [bTier({ duration: "1 Day" })] } }]);
    expect(await release("Loop", "1 Day", OWNER_TENANT_ID)).toMatchObject({ success: false });
    expect(calls).toHaveLength(0);
  });
  it("owner LOCAL-stock products can be sold through JPRIME too: key claimed from OWNER stock, cost taken; none left = refund", async () => {
    tables.wallets = []; seed("wallets", [{ tenant_id: OWNER_TENANT_ID, username: "rajreseller", balance: 1000 }]);
    tables.stock_keys = [];
    seed("stock_keys", [{ tenant_id: OWNER_TENANT_ID, product_name: "PUBG X", duration: "30 days", key_code: "LOCAL-KEY-1", is_used: false }]);
    const b = tables.products_catalog.find((x) => x.tenant_id === TENANT_B) as any;
    b.data.prices.push(bTier({ duration: "30 Days", jprimeDuration: "30 days" }));
    const ok = await release("Raj PUBG", "30 Days");
    expect(ok).toMatchObject({ success: true, key: "LOCAL-KEY-1" });
    expect(wallet("rajreseller")).toBe(750);
    expect(calls).toHaveLength(0); // no seller API involved
    const none = await release("Raj PUBG", "30 Days");
    expect(none.success).toBe(false);
    expect(wallet("rajreseller")).toBe(750); // refunded
  });
});

describe("co-admin's OWN seller key", () => {
  const sTier = { duration: "1 Day", priceINR: "60", supplier: "SELLER1", seller1Pid: "MYPID", seller1Duration: "1" };
  beforeEach(() => { seed("products_catalog", [{ tenant_id: TENANT_B, product_id: "own1", name: "Own Product", data: { id: "own1", name: "Own Product", prices: [sTier] } }]); });
  it("no approved connection: refused, and the OWNER's keys are never used", async () => {
    expect(await release("Own Product")).toMatchObject({ success: false, error: "Inventory is not configured for this store yet." });
    expect(calls).toHaveLength(0);
  });
  it("approved + key: uses THEIR key (master optional), never the owner's", async () => {
    tables.tenant_api_connections.push({ tenant_id: TENANT_B, status: "approved", assigned_seller: "SELLER1", api_key: "RAJ-OWN-KEY", master_key: null });
    const r = await release("Own Product");
    expect(r).toMatchObject({ success: true, key: "S1-KEY" });
    expect(calls[0].body).toContain("RAJ-OWN-KEY"); expect(calls[0].body).not.toContain("OWNER-S1-KEY");
    expect(JSON.stringify(calls[0].headers)).not.toContain("OWNER-MASTER");
  });
  it("another store's approval does not count; pending/rejected do not count; seller must match", async () => {
    tables.tenant_api_connections.push(
      { tenant_id: TENANT_C, status: "approved", assigned_seller: "SELLER1", api_key: "C-KEY" },
      { tenant_id: TENANT_B, status: "pending", assigned_seller: "SELLER1", api_key: "P-KEY" },
      { tenant_id: TENANT_B, status: "approved", assigned_seller: "SELLER2", api_key: "S2-ONLY" },
    );
    expect(await release("Own Product")).toMatchObject({ success: false });
    expect(calls).toHaveLength(0);
  });

});
