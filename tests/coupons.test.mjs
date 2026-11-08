// Pure-logic tests for coupon codes. No database, no network.
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCode,
  sanitizeCoupons,
  isCouponActive,
  findCoupon,
  applyPercentOff,
  publicCouponView,
  percentsFor,
  formatPercents,
} from "../lib/coupons.ts";

const mk = (over = {}) => ({ id: "1", code: "SAVE10", percent: 10, scope: "all", products: [], enabled: true, startsAt: null, endsAt: null, ...over });

test("codes are trimmed, upper-cased and validated", () => {
  assert.equal(normalizeCode("  save 10 "), "SAVE10");
  assert.equal(sanitizeCoupons([mk({ code: "ab" })]).length, 0); // too short
  assert.equal(sanitizeCoupons([mk({ code: "BAD CODE!" })]).length, 0);
  assert.equal(sanitizeCoupons([mk({ percent: 0 })]).length, 0);
  assert.equal(sanitizeCoupons([mk({ percent: 95 })]).length, 0);
  assert.equal(sanitizeCoupons([mk({ percent: 12.5 })]).length, 0);
  assert.equal(sanitizeCoupons([mk({ scope: "products", products: [] })]).length, 0);
  assert.equal(sanitizeCoupons([mk(), mk({ id: "2" })]).length, 1); // duplicate code dropped
});

test("price maths: whole rupees, never below 1", () => {
  assert.equal(applyPercentOff(40, 10), 36);
  assert.equal(applyPercentOff(55, 10), 50); // 49.5 rounds to 50
  assert.equal(applyPercentOff(1, 90), 1);
  assert.equal(applyPercentOff(100, 0), 100); // invalid percent leaves price alone
  assert.equal(applyPercentOff(100, 99), 100);
});

test("only an enabled coupon inside its dates is active", () => {
  const now = new Date("2026-11-10T00:00:00Z");
  assert.equal(isCouponActive(mk(), now), true);
  assert.equal(isCouponActive(mk({ enabled: false }), now), false);
  assert.equal(isCouponActive(mk({ startsAt: "2026-11-11T00:00:00Z" }), now), false);
  assert.equal(isCouponActive(mk({ endsAt: "2026-11-09T00:00:00Z" }), now), false);
  assert.equal(isCouponActive(mk({ endsAt: "2026-11-10T00:00:00Z" }), now), false); // end is exclusive
});

test("a typed code works only for the products it covers (styled names match plain)", () => {
  const coupons = [
    mk(),
    mk({ id: "2", code: "PHANTOM20", percent: 20, scope: "products", products: ["𝗣𝗛𝗔𝗡𝗧𝗢𝗠 - 𝗡𝗢𝗡 𝗥𝗢𝗢𝗧"] }),
  ];
  assert.equal(findCoupon(coupons, " save10 ", "Anything")?.percent, 10);
  assert.equal(findCoupon(coupons, "PHANTOM20", "PHANTOM - NON ROOT")?.percent, 20);
  assert.equal(findCoupon(coupons, "PHANTOM20", "Other product"), null);
  assert.equal(findCoupon(coupons, "NOPE", "Anything"), null);
  assert.equal(findCoupon(coupons, "", "Anything"), null);
});

test("public view exposes percentages only, never codes", () => {
  const coupons = [
    mk(),
    mk({ id: "2", code: "P20", percent: 20, scope: "products", products: ["Phantom"] }),
    mk({ id: "3", code: "P30", percent: 30, scope: "products", products: ["Phantom", "Duck"] }),
    mk({ id: "4", code: "OFF50", percent: 50, enabled: false }),
  ];
  const view = publicCouponView(coupons);
  assert.deepEqual(view.all, [10]);
  assert.deepEqual(view.products, { Phantom: [20, 30], Duck: [30] });
  assert.ok(!JSON.stringify(view).includes("SAVE10"));
  assert.deepEqual(percentsFor(view, "phantom"), [10, 20, 30]);
  assert.deepEqual(percentsFor(view, "Unknown"), [10]);
  assert.deepEqual(percentsFor(null, "x"), []);
});

test("range text for the card", () => {
  assert.equal(formatPercents([]), "");
  assert.equal(formatPercents([10]), "10%");
  assert.equal(formatPercents([10, 20, 30]), "10% · 20% · 30%");
  assert.equal(formatPercents([5, 10, 20, 50]), "5–50%");
});
