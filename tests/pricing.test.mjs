// Pure-logic tests for bulk prices and store discounts. No database, no network.
import test from "node:test";
import assert from "node:assert/strict";

import { computeBulkPrice, applyPercentOff, parseScope, scopeMatches, parseRupees } from "../lib/price-math.ts";
import { sanitizeRules, isRuleActive, bestDiscountFor, priceView } from "../lib/discounts.ts";

test("customer discount rounds to whole rupees and never below 1", () => {
  assert.equal(applyPercentOff(40, 10), 36); // ₹40 -> ₹36
  assert.equal(applyPercentOff(200, 10), 180);
  assert.equal(applyPercentOff(500, 10), 450);
  assert.equal(applyPercentOff(1, 90), 1);
  assert.equal(applyPercentOff(100, 0), 100);
  assert.equal(applyPercentOff(100, 100), 100); // invalid -> unchanged
});

test("bulk price modes", () => {
  assert.equal(computeBulkPrice(450, "percent_off", 20), 360);
  assert.equal(computeBulkPrice(450, "percent_up", 10), 495);
  assert.equal(computeBulkPrice(450, "flat_off", 50), 400);
  assert.equal(computeBulkPrice(450, "flat_up", 25), 475);
});

test("bulk rounding to nearest 5 / 10", () => {
  assert.equal(computeBulkPrice(333, "percent_off", 10, 0), 300); // 299.7 -> 300
  assert.equal(computeBulkPrice(333, "percent_off", 10, 5), 300);
  assert.equal(computeBulkPrice(347, "percent_off", 10, 10), 310); // 312.3 -> 310
  assert.equal(computeBulkPrice(347, "percent_off", 10, 5), 310);
});

test("bulk price refuses unusable results instead of producing 0 or negative prices", () => {
  assert.equal(computeBulkPrice(40, "flat_off", 40), null);
  assert.equal(computeBulkPrice(40, "flat_off", 100), null);
  assert.equal(computeBulkPrice(40, "percent_off", 100), null);
  assert.equal(computeBulkPrice(0, "percent_off", 10), null);
  assert.equal(computeBulkPrice(NaN, "percent_off", 10), null);
  assert.equal(computeBulkPrice(40, "percent_off", -5), null);
});

test("parseRupees reads display strings", () => {
  assert.equal(parseRupees("₹1,200"), 1200);
  assert.equal(parseRupees("450"), 450);
  assert.equal(parseRupees(""), null);
  assert.equal(parseRupees("free"), null);
});

test("scope parsing and matching", () => {
  assert.equal(parseScope({ type: "bad" }), null);
  assert.equal(parseScope({ type: "products", products: [] }), null);
  assert.deepEqual(parseScope({ type: "category", category: " PC " }), { type: "category", category: "pc" });
  const all = parseScope({ type: "all" });
  const pc = parseScope({ type: "category", category: "pc" });
  const some = parseScope({ type: "products", products: ["A", " B "] });
  assert.equal(scopeMatches(all, { name: "X", category: "ios" }), true);
  assert.equal(scopeMatches(pc, { name: "X", category: "PC" }), true);
  assert.equal(scopeMatches(pc, { name: "X", category: "mobile" }), false);
  assert.equal(scopeMatches(some, { name: "B" }), true);
  assert.equal(scopeMatches(some, { name: "C" }), false);
});

const NOW = new Date("2026-11-10T12:00:00.000Z");
const rule = (over = {}) => ({
  id: "r1", label: "Sale", percent: 10, scope: { type: "all" }, startsAt: null, endsAt: null, enabled: true, ...over,
});

test("rules are validated and bad ones dropped", () => {
  const rules = sanitizeRules([
    rule(),
    rule({ id: "", }),
    rule({ id: "r2", percent: 0 }),
    rule({ id: "r3", percent: 95 }),
    rule({ id: "r4", scope: { type: "nope" } }),
    rule({ id: "r5", label: "  ", percent: "15" }),
  ]);
  assert.deepEqual(rules.map((r) => r.id), ["r1", "r5"]);
  assert.equal(rules[1].label, "Sale");
  assert.equal(rules[1].percent, 15);
  assert.deepEqual(sanitizeRules(null), []);
});

test("rule schedule and on/off switch", () => {
  assert.equal(isRuleActive(rule(), NOW), true);
  assert.equal(isRuleActive(rule({ enabled: false }), NOW), false);
  assert.equal(isRuleActive(rule({ startsAt: "2026-11-11T00:00:00Z" }), NOW), false); // not started
  assert.equal(isRuleActive(rule({ endsAt: "2026-11-10T11:00:00Z" }), NOW), false); // ended
  assert.equal(isRuleActive(rule({ startsAt: "2026-11-10T00:00:00Z", endsAt: "2026-11-11T00:00:00Z" }), NOW), true);
});

test("best rule wins, rules never stack, scope respected", () => {
  const rules = [
    rule({ id: "a", percent: 10 }),
    rule({ id: "b", percent: 25, scope: { type: "category", category: "pc" } }),
    rule({ id: "c", percent: 40, scope: { type: "products", products: ["Only This"] } }),
    rule({ id: "d", percent: 50, enabled: false }),
  ];
  assert.equal(bestDiscountFor(rules, { name: "Phone", category: "mobile" }, NOW).id, "a");
  assert.equal(bestDiscountFor(rules, { name: "Rig", category: "pc" }, NOW).id, "b");
  assert.equal(bestDiscountFor(rules, { name: "Only This", category: "pc" }, NOW).id, "c");
  assert.equal(bestDiscountFor([], { name: "x" }, NOW), null);
});

test("price view gives the struck price, saving and percent (₹40 -> ₹36, save ₹4)", () => {
  const view = priceView(40, sanitizeRules([rule({ label: "Diwali", endsAt: "2026-11-12T00:00:00Z" })]), { name: "P" }, NOW);
  assert.deepEqual(view, { final: 36, original: 40, percent: 10, saving: 4, label: "Diwali", endsAt: "2026-11-12T00:00:00.000Z" });
  const none = priceView(40, [], { name: "P" }, NOW);
  assert.deepEqual(none, { final: 40, original: null, percent: null, saving: null, label: null, endsAt: null });
});
