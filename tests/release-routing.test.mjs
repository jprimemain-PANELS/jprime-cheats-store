// Run with:  npm run test:logic
// Exercises lib/release-product.ts end to end against an in-memory database and a fake fetch.
// No real database, supplier API, payment gateway or network is ever contacted.
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { state } from "./stubs/supabase-admin.mjs";

process.env.RESELLER_API_KEY = "test-reseller-key";
process.env.RESELLER_MASTER_KEY = "test-master-key";
process.env.SELLER2_API_TOKEN = "test-seller2-token";

const SELLER1_URL = "https://bantibhaiya.to/api/reseller_v1.php";
const SELLER2_URL = "https://whitexmodz.store/api/v1/generate_key.php";

const OWNER = "00000000-0000-0000-0000-000000000001";
let fetchCalls = [];
globalThis.fetch = async (url, init) => {
  fetchCalls.push({ url: String(url), body: String(init?.body ?? "") });
  const body = String(url).includes("bantibhaiya")
    ? { status: "success", data: { key: "S1-KEY-123" } }
    : { success: true, keys: ["S2-KEY-456"] };
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
};

const { releaseProduct } = await import("../lib/release-product.ts");
const { allProducts } = await import("../lib/products.ts");
const { countLocalStock } = await import("../lib/stock.ts");

/* helpers ------------------------------------------------------------------------------ */

let catalogExact = [];
let catalogAll = [];
let catalogError = null;
let stockRows = [];

const stockSelects = () => state.ops.filter((o) => o.table === "stock_keys" && !o.update);
const stockUpdates = () => state.ops.filter((o) => o.table === "stock_keys" && o.update);

beforeEach(() => {
  fetchCalls = [];
  state.ops = [];
  catalogExact = [];
  catalogAll = [];
  catalogError = null;
  stockRows = [];

  state.handler = (op) => {
    if (op.table === "products_catalog") {
      if (catalogError) return { data: null, error: { message: catalogError } };
      return { data: op.filters.filter((f) => f[1] !== "tenant_id").length ? catalogExact : catalogAll, error: null };
    }
    if (op.table === "stock_keys") {
      if (op.update) {
        const id = op.filters.find((f) => f[1] === "id")?.[2];
        const row = stockRows.find((r) => r.id === id && r.is_used === false);
        if (!row) return { data: null, error: null };
        row.is_used = true;
        return { data: { id }, error: null };
      }
      const unused = stockRows.filter((r) => r.is_used === false);
      return { data: op.range ? unused.slice(op.range[0], op.range[1] + 1) : unused, error: null };
    }
    return { data: [], error: null };
  };
});

const catalogRow = (name, prices, extra = {}) => ({
  product_id: "p1",
  name,
  data: { id: "p1", name, fulfillmentType: "LOCAL", prices, ...extra },
});

/* tests -------------------------------------------------------------------------------- */

test("catalogue DATABASE ERROR stops the purchase: no local stock, no supplier call", async () => {
  catalogError = "connection reset";
  stockRows = [{ id: 1, product_name: "Phantom", duration: "1 day", key_code: "LOCAL-KEY", is_used: false }];

  const result = await releaseProduct({ tenantId: OWNER, username: "u", product_name: "Phantom", duration: "1 day" });

  assert.equal(result.success, false);
  assert.match(result.error, /catalogue could not be read/i);
  assert.equal(stockSelects().length, 0);
  assert.equal(stockUpdates().length, 0);
  assert.equal(fetchCalls.length, 0);
});

test("duplicate catalogue rows for one name stop the purchase (no silent fallback)", async () => {
  catalogExact = [catalogRow("Phantom", []), catalogRow("Phantom", [])];
  const result = await releaseProduct({ tenantId: OWNER, username: "u", product_name: "Phantom", duration: "1 day" });
  assert.equal(result.success, false);
  assert.equal(stockSelects().length, 0);
  assert.equal(fetchCalls.length, 0);
});

test("SELLER1 duration uses the Seller 1 product id + duration and never local stock", async () => {
  catalogExact = [
    catalogRow("Phantom", [
      { duration: "1 day", supplier: "SELLER1", seller1Pid: "136", seller1Duration: "1day", seller2VariantId: "999" },
    ]),
  ];
  stockRows = [{ id: 1, product_name: "Phantom", duration: "1 day", key_code: "LOCAL-KEY", is_used: false }];

  const result = await releaseProduct({ tenantId: OWNER, username: "u", product_name: "Phantom", duration: "1 day" });

  assert.deepEqual(result, { success: true, key: "S1-KEY-123" });
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, SELLER1_URL);
  const body = new URLSearchParams(fetchCalls[0].body);
  assert.equal(body.get("product_id"), "136");
  assert.equal(body.get("duration"), "1day");
  assert.equal(stockSelects().length, 0);
  assert.equal(stockRows[0].is_used, false); // local key untouched
});

test("SELLER2 duration uses the Seller 2 variant id, not Seller 1 and not local stock", async () => {
  catalogExact = [
    catalogRow("Drip", [
      { duration: "1 day", supplier: "SELLER2", seller2VariantId: "167", seller1Pid: "62", seller1Duration: "1day" },
    ]),
  ];
  stockRows = [{ id: 1, product_name: "Drip", duration: "1 day", key_code: "LOCAL-KEY", is_used: false }];

  const result = await releaseProduct({ tenantId: OWNER, username: "u", product_name: "Drip", duration: "1 day" });

  assert.deepEqual(result, { success: true, key: "S2-KEY-456" });
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, SELLER2_URL);
  assert.equal(new URLSearchParams(fetchCalls[0].body).get("variant_id"), "167");
  assert.equal(stockSelects().length, 0);
});

test("LOCAL duration reserves the oldest matching key (case/space tolerant) and calls no supplier", async () => {
  catalogExact = [catalogRow("Phantom - Non Root", [{ duration: "1 Day", supplier: "LOCAL" }])];
  stockRows = [
    { id: 7, product_name: "phantom - non root ", duration: "1 day", key_code: "LOCAL-KEY-A", is_used: false },
    { id: 8, product_name: "Phantom - Non Root", duration: "1 Day", key_code: "LOCAL-KEY-B", is_used: false },
    { id: 9, product_name: "Phantom - Non Root", duration: "7 Day", key_code: "WRONG-DURATION", is_used: false },
  ];

  const result = await releaseProduct({ tenantId: OWNER, username: "u", product_name: "Phantom - Non Root", duration: "1 Day" });

  assert.deepEqual(result, { success: true, key: "LOCAL-KEY-A" });
  assert.equal(fetchCalls.length, 0);
  assert.equal(stockRows.find((r) => r.id === 7).is_used, true);
  assert.equal(stockRows.find((r) => r.id === 8).is_used, false);
  assert.equal(stockRows.find((r) => r.id === 9).is_used, false);
});

test("LOCAL with no matching key fails cleanly (and never calls a supplier)", async () => {
  catalogExact = [catalogRow("Phantom", [{ duration: "1 day", supplier: "LOCAL" }])];
  const result = await releaseProduct({ tenantId: OWNER, username: "u", product_name: "Phantom", duration: "1 day" });
  assert.equal(result.success, false);
  assert.equal(fetchCalls.length, 0);
});

test("catalogue duration without a supplier is an error, never local stock", async () => {
  catalogExact = [catalogRow("Phantom", [{ duration: "1 day", seller1Pid: "1", seller1Duration: "1day" }])];
  stockRows = [{ id: 1, product_name: "Phantom", duration: "1 day", key_code: "LOCAL-KEY", is_used: false }];

  const result = await releaseProduct({ tenantId: OWNER, username: "u", product_name: "Phantom", duration: "1 day" });

  assert.equal(result.success, false);
  assert.match(result.error, /Supplier is not configured/);
  assert.equal(stockSelects().length, 0);
  assert.equal(fetchCalls.length, 0);
});

test("SELLER1 with a missing product id is an error, not a local fallback", async () => {
  catalogExact = [catalogRow("Phantom", [{ duration: "1 day", supplier: "SELLER1", seller1Duration: "1day" }])];
  stockRows = [{ id: 1, product_name: "Phantom", duration: "1 day", key_code: "LOCAL-KEY", is_used: false }];

  const result = await releaseProduct({ tenantId: OWNER, username: "u", product_name: "Phantom", duration: "1 day" });

  assert.equal(result.success, false);
  assert.equal(fetchCalls.length, 0);
  assert.equal(stockSelects().length, 0);
});

test("catalogue name that differs only by case/spacing is still found", async () => {
  catalogExact = []; // exact lookup misses
  catalogAll = [catalogRow("  PHANTOM  non root", [{ duration: "1 day", supplier: "SELLER2", seller2VariantId: "5" }])];

  const result = await releaseProduct({ tenantId: OWNER, username: "u", product_name: "Phantom Non Root", duration: "1 day" });

  assert.deepEqual(result, { success: true, key: "S2-KEY-456" });
  assert.equal(stockSelects().length, 0);
});

test("a product genuinely missing from the catalogue and the legacy list is 'not found'", async () => {
  const result = await releaseProduct({ tenantId: OWNER, username: "u", product_name: "Does Not Exist", duration: "1 day" });
  assert.equal(result.success, false);
  assert.match(result.error, /not found/i);
  assert.equal(stockSelects().length, 0);
  assert.equal(fetchCalls.length, 0);
});

test("genuinely missing from catalogue: legacy LOCAL product uses local stock", async () => {
  const legacy = allProducts.find((p) => p.fulfillmentType === "LOCAL" && !p.sellerPid && p.prices.length);
  assert.ok(legacy, "needs a legacy LOCAL product");
  const tier = legacy.prices[0];
  stockRows = [{ id: 1, product_name: legacy.name, duration: tier.duration, key_code: "LEGACY-LOCAL", is_used: false }];

  const result = await releaseProduct({ tenantId: OWNER, username: "u", product_name: legacy.name, duration: tier.duration });

  assert.deepEqual(result, { success: true, key: "LEGACY-LOCAL" });
  assert.equal(fetchCalls.length, 0);
});

test("genuinely missing from catalogue: legacy Seller 1 product uses Seller 1, never local stock", async () => {
  const legacy = allProducts.find((p) => p.sellerPid && p.prices.some((t) => t.sellerDuration));
  assert.ok(legacy, "needs a legacy Seller 1 product");
  const tier = legacy.prices.find((t) => t.sellerDuration);
  stockRows = [{ id: 1, product_name: legacy.name, duration: tier.duration, key_code: "LOCAL-KEY", is_used: false }];

  const result = await releaseProduct({ tenantId: OWNER, username: "u", product_name: legacy.name, duration: tier.duration });

  assert.equal(result.success, true);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, SELLER1_URL);
  assert.equal(new URLSearchParams(fetchCalls[0].body).get("product_id"), String(legacy.sellerPid));
  assert.equal(stockSelects().length, 0);
});

test("two buyers racing for the same key: the loser takes the next key instead of failing", async () => {
  catalogExact = [catalogRow("Phantom", [{ duration: "1 day", supplier: "LOCAL" }])];
  stockRows = [
    { id: 1, product_name: "Phantom", duration: "1 day", key_code: "K1", is_used: false },
    { id: 2, product_name: "Phantom", duration: "1 day", key_code: "K2", is_used: false },
  ];
  // simulate another buyer grabbing K1 between our read and our update
  const original = state.handler;
  state.handler = (op) => {
    if (op.table === "stock_keys" && op.update && op.filters.find((f) => f[1] === "id")?.[2] === 1) {
      stockRows[0].is_used = true;
    }
    return original(op);
  };

  const result = await releaseProduct({ tenantId: OWNER, username: "u", product_name: "Phantom", duration: "1 day" });
  assert.deepEqual(result, { success: true, key: "K2" });
});

test("styled catalogue names find keys stored styled OR plain, and the oldest key is used first", async () => {
  catalogExact = [catalogRow("𝗣𝗛𝗔𝗡𝗧𝗢𝗠 - 𝗡𝗢𝗡 𝗥𝗢𝗢𝗧", [{ duration: "1 day", supplier: "LOCAL" }])];
  stockRows = [
    { id: 4, product_name: "PHANTOM - NON ROOT", duration: "1 day", key_code: "PLAIN", is_used: false },
    { id: 5, product_name: "𝗣𝗛𝗔𝗡𝗧𝗢𝗠 - 𝗡𝗢𝗡 𝗥𝗢𝗢𝗧", duration: "1 day", key_code: "STYLED", is_used: false },
  ];

  const first = await releaseProduct({ tenantId: OWNER, username: "u", product_name: "𝗣𝗛𝗔𝗡𝗧𝗢𝗠 - 𝗡𝗢𝗡 𝗥𝗢𝗢𝗧", duration: "1 day" });
  const second = await releaseProduct({ tenantId: OWNER, username: "u", product_name: "𝗣𝗛𝗔𝗡𝗧𝗢𝗠 - 𝗡𝗢𝗡 𝗥𝗢𝗢𝗧", duration: "1 day" });

  assert.deepEqual(first, { success: true, key: "PLAIN" });
  assert.deepEqual(second, { success: true, key: "STYLED" });
  assert.equal(fetchCalls.length, 0);
});

test("customer/admin count reads every page (more than 1000 keys) with the same rule", async () => {
  stockRows = Array.from({ length: 2300 }, (_, i) => ({
    id: i + 1,
    product_name: i % 2 === 0 ? "𝗗𝗨𝗖𝗞 𝗠𝗢𝗗- 𝗡𝗢𝗡 𝗥𝗢𝗢𝗧" : "duck mod- non root ",
    duration: "7 day",
    key_code: `K${i}`,
    is_used: false,
  }));
  stockRows.push({ id: 9999, product_name: "𝗗𝗨𝗖𝗞 𝗠𝗢𝗗- 𝗡𝗢𝗡 𝗥𝗢𝗢𝗧", duration: "7 day", key_code: "USED", is_used: true });

  const result = await countLocalStock(OWNER, "𝗗𝗨𝗖𝗞 𝗠𝗢𝗗- 𝗡𝗢𝗡 𝗥𝗢𝗢𝗧", "7 day", { fresh: true });
  assert.deepEqual(result, { ok: true, data: 2300 });
  assert.deepEqual(await countLocalStock(OWNER, "𝗗𝗨𝗖𝗞 𝗠𝗢𝗗- 𝗡𝗢𝗡 𝗥𝗢𝗢𝗧", "30 day", { fresh: true }), { ok: true, data: 0 });
});
