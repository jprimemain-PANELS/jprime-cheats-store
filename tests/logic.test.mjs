// Run with:  npm run test:logic
// Pure-logic tests only: no database, no network, no supplier or payment API is ever called.
import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeSupplier,
  resolveCatalogSupplier,
  inferSupplier,
  isAmbiguousSupplier,
  deliveryModeForTier,
  summarizeFulfillment,
  normalizeStockText,
  stockRowMatches,
  countAvailableStock,
  buildStockCountMap,
  stockCountKey,
} from "../lib/delivery.ts";
import { parseVideoSource } from "../lib/video.ts";
import { normalizeProduct, routingProblems, legacyToCatalogProduct } from "../lib/catalog-edit.ts";

/* ------------------------------------------------------------------ supplier preservation */

test("normalizeSupplier accepts the stored forms and never invents LOCAL", () => {
  assert.equal(normalizeSupplier("SELLER1"), "SELLER1");
  assert.equal(normalizeSupplier(" seller 2 "), "SELLER2");
  assert.equal(normalizeSupplier("Local Stock"), "LOCAL");
  assert.equal(normalizeSupplier(""), null);
  assert.equal(normalizeSupplier(undefined), null);
  assert.equal(normalizeSupplier("nonsense"), null);
});

test("loading a stored product keeps SELLER1 / SELLER2 routing and every id", () => {
  const stored = {
    id: "p1",
    name: "Phantom",
    sellerPid: "legacy-extra-field",
    prices: [
      { duration: "1 day", priceINR: "100", supplier: "SELLER1", seller1Pid: "136", seller1Duration: "1day" },
      { duration: "7 day", priceINR: "400", supplier: "SELLER2", seller2VariantId: 167, seller1Pid: "62", seller1Duration: "7day" },
      { duration: "30 day", priceINR: "900", supplier: "LOCAL" },
    ],
  };
  const loaded = normalizeProduct(stored);
  assert.deepEqual(loaded.prices.map((t) => t.supplier), ["SELLER1", "SELLER2", "LOCAL"]);
  assert.equal(loaded.prices[0].seller1Pid, "136");
  assert.equal(loaded.prices[0].seller1Duration, "1day");
  assert.equal(loaded.prices[1].seller2VariantId, "167");
  // seller 1 data on a SELLER2 duration is not thrown away
  assert.equal(loaded.prices[1].seller1Pid, "62");
  // unknown product-level fields survive a load/save round trip
  assert.equal(loaded.sellerPid, "legacy-extra-field");
});

test("a missing supplier is NOT turned into LOCAL", () => {
  const loaded = normalizeProduct({
    id: "x",
    name: "X",
    prices: [
      { duration: "1 day", priceINR: "1" },
      { duration: "3 day", priceINR: "1", seller2VariantId: "55" },
    ],
  });
  assert.equal(loaded.prices[0].supplier, ""); // nothing configured -> must be chosen
  assert.equal(loaded.prices[1].supplier, "SELLER2"); // only Seller 2 configured -> detected
  assert.ok(routingProblems(loaded).some((p) => p.includes("no supplier chosen")));
});

test("both sellers configured and no supplier stays 'not chosen' (ambiguous)", () => {
  const loaded = normalizeProduct({
    id: "x",
    name: "X",
    prices: [{ duration: "1 day", priceINR: "1", seller1Pid: "1", seller1Duration: "1day", seller2VariantId: "9" }],
  });
  assert.equal(loaded.prices[0].supplier, "");
});

test("routing problems flag LOCAL durations that still hold Seller ids", () => {
  const loaded = normalizeProduct({
    id: "x",
    name: "X",
    prices: [{ duration: "1 day", priceINR: "1", supplier: "LOCAL", seller2VariantId: "9" }],
  });
  assert.ok(routingProblems(loaded).some((p) => p.includes("set to LOCAL but has Seller IDs")));
});

test("strict purchase-time resolution: missing or invalid supplier is an error, never LOCAL", () => {
  assert.deepEqual(resolveCatalogSupplier({}), { ok: false, reason: "missing" });
  assert.deepEqual(resolveCatalogSupplier({ supplier: "weird" }), { ok: false, reason: "invalid" });
  assert.deepEqual(resolveCatalogSupplier({ supplier: "seller2" }), { ok: true, supplier: "SELLER2" });
  assert.deepEqual(resolveCatalogSupplier({ supplier: "LOCAL" }), { ok: true, supplier: "LOCAL" });
});

/* ------------------------------------------------------------------ Import Existing mapping */

test("Import Existing maps by real configuration, not 'API = Seller 1'", () => {
  const notes = [];
  const imported = legacyToCatalogProduct(
    {
      id: "drip",
      name: "DRIP",
      fulfillmentType: "API",
      prices: [
        { duration: "1 day", priceINR: "₹1", seller2VariantId: 167 }, // Seller 2 only
        { duration: "7 day", priceINR: "₹7" }, // API with no configuration at all
      ],
    },
    notes
  );
  assert.equal(imported.prices[0].supplier, "SELLER2");
  assert.equal(imported.prices[0].seller2VariantId, "167");
  assert.equal(imported.prices[1].supplier, ""); // not guessed
  assert.equal(imported.status, "MAINTENANCE"); // not sellable until someone chooses
  assert.ok(notes.some((n) => n.includes("no supplier configuration")));
});

test("Import Existing: Seller 1 product, local product and both-configured product", () => {
  const notes = [];
  const s1 = legacyToCatalogProduct(
    { id: "a", name: "A", fulfillmentType: "API", sellerPid: "136", prices: [{ duration: "1 day", priceINR: "1", sellerDuration: "1" }] },
    notes
  );
  assert.equal(s1.prices[0].supplier, "SELLER1");
  assert.equal(s1.prices[0].seller1Pid, "136");
  assert.equal(s1.fulfillmentType, "API");

  const local = legacyToCatalogProduct({ id: "b", name: "B", fulfillmentType: "LOCAL", prices: [{ duration: "1 day", priceINR: "1" }] }, notes);
  assert.equal(local.prices[0].supplier, "LOCAL");
  assert.equal(local.fulfillmentType, "LOCAL");

  const both = legacyToCatalogProduct(
    { id: "c", name: "C", fulfillmentType: "API", sellerPid: "62", prices: [{ duration: "1 day", priceINR: "1", sellerDuration: "1", seller2VariantId: 5 }] },
    notes
  );
  assert.equal(both.prices[0].supplier, "SELLER1"); // what the old purchase code did
  assert.equal(both.prices[0].seller2VariantId, "5"); // kept, not dropped
  assert.ok(notes.some((n) => n.includes("both configured")));
  assert.equal(isAmbiguousSupplier({ seller1Pid: "62", sellerDuration: "1", seller2VariantId: 5 }), true);
});

test("inferSupplier never answers LOCAL for an API product with no configuration", () => {
  assert.equal(inferSupplier({}, { fulfillmentType: "API" }), null);
  assert.equal(inferSupplier({}, { fulfillmentType: "LOCAL" }), "LOCAL");
});

/* ------------------------------------------------------------------ delivery-mode selection */

test("delivery mode follows the DURATION's supplier, not the product flag", () => {
  assert.equal(deliveryModeForTier({ supplier: "SELLER1" }, "LOCAL"), "API"); // product flag wrong/stale
  assert.equal(deliveryModeForTier({ supplier: "SELLER2" }, undefined), "API");
  assert.equal(deliveryModeForTier({ supplier: "LOCAL" }, "API"), "LOCAL");
});

test("delivery mode for old data without a supplier field", () => {
  assert.equal(deliveryModeForTier({ seller2VariantId: 12 }, undefined), "API");
  assert.equal(deliveryModeForTier({ seller1Pid: "1", sellerDuration: "1" }, "LOCAL"), "API");
  assert.equal(deliveryModeForTier({}, "LOCAL"), "LOCAL");
  assert.equal(deliveryModeForTier({}, "API"), "API");
  assert.equal(deliveryModeForTier({}, undefined), "LOCAL");
});

test("mixed product: Seller durations are API, Local durations use stock", () => {
  const tiers = [{ supplier: "SELLER1" }, { supplier: "LOCAL" }, { supplier: "SELLER2" }];
  const modes = tiers.map((t) => deliveryModeForTier(t, "LOCAL"));
  assert.deepEqual(modes, ["API", "LOCAL", "API"]);
  assert.equal(summarizeFulfillment(modes), "LOCAL"); // safest summary for old code
  assert.equal(summarizeFulfillment(["API", "API"]), "API");
  assert.equal(summarizeFulfillment([]), "LOCAL");
});

/* ------------------------------------------------------------------ stock matching */

const rows = [
  { id: 1, product_name: "Phantom - Non Root", duration: "1 Day", is_used: false },
  { id: 2, product_name: "phantom - non root ", duration: "1 day", is_used: false }, // case + trailing space
  { id: 3, product_name: " Phantom -  Non Root", duration: " 1  DAY ", is_used: false }, // leading + double spaces
  { id: 4, product_name: "Phantom - Non Root", duration: "1 Day", is_used: true }, // already sold
  { id: 5, product_name: "Phantom - Non Root", duration: "7 Day", is_used: false }, // other duration
  { id: 6, product_name: "Other Product", duration: "1 Day", is_used: false },
  { id: 7, product_name: "Phantom\u00a0-\u00a0Non Root", duration: "1\u200b Day", is_used: false }, // NBSP + zero width
];

test("stock matching ignores letter case, extra spaces and invisible characters", () => {
  assert.equal(normalizeStockText(" A\u00a0  b\u200b "), "a b");
  assert.equal(countAvailableStock(rows, "Phantom - Non Root", "1 Day"), 4);
});

test("stock matching never mixes durations or products, and skips used keys", () => {
  assert.equal(countAvailableStock(rows, "Phantom - Non Root", "7 Day"), 1);
  assert.equal(countAvailableStock(rows, "Phantom - Non Root", "30 Day"), 0);
  assert.equal(countAvailableStock(rows, "Other Product", "1 Day"), 1);
  assert.equal(stockRowMatches(rows[3], "Phantom - Non Root", "1 Day"), true); // matching is separate from is_used
  assert.equal(countAvailableStock([rows[3]], "Phantom - Non Root", "1 Day"), 0); // but counting skips it
});

test("admin matrix map and single count agree (one rule everywhere)", () => {
  const map = buildStockCountMap(rows);
  for (const [product, duration] of [["Phantom - Non Root", "1 Day"], ["Phantom - Non Root", "7 Day"], ["Other Product", "1 Day"], ["Nope", "1 Day"]]) {
    assert.equal(map.get(stockCountKey(product, duration)) ?? 0, countAvailableStock(rows, product, duration));
  }
});

test("counting is not capped at 1000 rows", () => {
  const many = Array.from({ length: 2500 }, (_, i) => ({ id: i, product_name: "Big", duration: "1 Day", is_used: false }));
  assert.equal(countAvailableStock(many, "big", "1 day"), 2500);
  assert.equal(buildStockCountMap(many).get(stockCountKey("Big", "1 Day")), 2500);
});

test("styled Unicode letters match their plain-letter spelling", () => {
  assert.equal(normalizeStockText("𝗣𝗛𝗔𝗡𝗧𝗢𝗠 - 𝗡𝗢𝗡 𝗥𝗢𝗢𝗧"), "phantom - non root");
  const styledRows = [
    { id: 1, product_name: "𝗣𝗛𝗔𝗡𝗧𝗢𝗠 - 𝗡𝗢𝗡 𝗥𝗢𝗢𝗧", duration: "1 day", is_used: false },
    { id: 2, product_name: "PHANTOM - NON ROOT", duration: "1 day", is_used: false },
    { id: 3, product_name: "𝗣𝗛𝗔𝗡𝗧𝗢𝗠 - 𝗜𝗢𝗦", duration: "1 day", is_used: false },
  ];
  assert.equal(countAvailableStock(styledRows, "𝗣𝗛𝗔𝗡𝗧𝗢𝗠 - 𝗡𝗢𝗡 𝗥𝗢𝗢𝗧", "1 day"), 2);
  assert.equal(countAvailableStock(styledRows, "𝗣𝗛𝗔𝗡𝗧𝗢𝗠 - 𝗜𝗢𝗦", "1 day"), 1);
});

/* ------------------------------------------------------------------ video */

test("YouTube watch, youtu.be, Shorts and embed URLs become a fixed embed URL", () => {
  const id = "dQw4w9WgXcQ";
  for (const url of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&feature=share`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/live/${id}`,
  ]) {
    const v = parseVideoSource(url);
    assert.equal(v?.kind, "youtube", url);
    assert.ok(v.embedUrl.startsWith(`https://www.youtube-nocookie.com/embed/${id}?`), url);
  }
  assert.ok(parseVideoSource(`https://youtu.be/${id}?t=1m30s`).embedUrl.includes("start=90"));
});

test("direct MP4 URLs keep working", () => {
  assert.deepEqual(parseVideoSource("https://res.cloudinary.com/demo/video/upload/v1/clip.mp4"), {
    kind: "file",
    src: "https://res.cloudinary.com/demo/video/upload/v1/clip.mp4",
  });
  assert.equal(parseVideoSource("/videos/clip.mp4")?.kind, "file");
});

test("unsafe or malformed video URLs render nothing", () => {
  for (const bad of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "blob:https://x/1",
    "file:///etc/passwd",
    "ftp://x/y.mp4",
    "//evil.example/x.mp4",
    "https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ%22onload%3Dx",
    "https://www.youtube.com/",
    "",
    "   ",
    undefined,
    null,
  ]) {
    assert.equal(parseVideoSource(bad), null, String(bad));
  }
  // lookalike host is not YouTube, so it is only ever a plain <video src>, never an iframe
  assert.equal(parseVideoSource("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ")?.kind, "file");
});
