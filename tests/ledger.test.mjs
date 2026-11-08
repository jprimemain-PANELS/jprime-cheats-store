// Pure-logic tests for the admin user ledger. No database, no network.
import test from "node:test";
import assert from "node:assert/strict";
import { buildUserLedger } from "../lib/user-ledger.ts";

const tx = [
  { id: 1, type: "deposit", amount: 500, balance_after: 500, description: "Wallet Deposit Verification Successful", created_at: "2026-11-01T10:00:00Z" },
  { id: 2, type: "purchase", amount: 36, balance_after: 464, description: "Purchase: Phantom (1 day)", created_at: "2026-11-02T08:00:05Z" },
  { id: 3, type: "credit", amount: 50, balance_after: 514, description: "Admin added funds", created_at: "2026-11-03T08:00:00Z" },
  { id: 4, type: "refund", amount: 36, balance_after: 550, description: "Refund (delivery failed): Duck (7 day)", created_at: "2026-11-04T08:00:00Z" },
  { id: 5, type: "purchase", amount: 90, balance_after: 460, description: "Purchase: Orphan (30 day)", created_at: "2026-11-05T08:00:00Z" },
];
const purchases = [
  { id: 10, product_name: "Phantom", duration: "1 day", price_paid: "36", key_code: "KEY-PHANTOM-1", purchased_at: "2026-11-02T08:00:03Z" }, // wallet
  { id: 11, product_name: "Rapid", duration: "7 day", price_paid: "180", key_code: "KEY-RAPID-7", purchased_at: "2026-11-03T12:00:00Z" }, // UPI
];

test("wallet purchase is merged into ONE line with its balance after and its key", () => {
  const { entries } = buildUserLedger(tx, purchases);
  const lines = entries.filter((e) => e.product === "Phantom");
  assert.equal(lines.length, 1);
  assert.equal(lines[0].method, "WALLET");
  assert.equal(lines[0].balanceAfter, 464);
  assert.equal(lines[0].keyStatus, "released");
  assert.equal(lines[0].keyText, "KEY-PHANTOM-1");
  assert.equal(lines[0].statusText, "Key released");
});

test("purchase without a wallet debit is Paid by UPI with the balance at that time", () => {
  const { entries } = buildUserLedger(tx, purchases);
  const upi = entries.find((e) => e.product === "Rapid");
  assert.equal(upi.kind, "upi_purchase");
  assert.equal(upi.method, "UPI");
  assert.equal(upi.balanceAfter, 514);
  assert.equal(upi.keyText, "KEY-RAPID-7");
});

test("a wallet debit with no key record is flagged as a problem, a refunded one as 'not released'", () => {
  const withFailure = [
    ...tx,
    { id: 3.5, type: "purchase", amount: 36, balance_after: 100, description: "Purchase: Duck (7 day)", created_at: "2026-11-03T20:00:00Z" },
  ];
  const { entries, summary } = buildUserLedger(withFailure, purchases);

  const orphan = entries.find((e) => e.product === "Orphan");
  assert.equal(orphan.keyStatus, "problem");
  assert.match(orphan.statusText, /No key record/);

  const duck = entries.find((e) => e.kind === "wallet_purchase" && e.product === "Duck");
  assert.equal(duck.keyStatus, "not_released");
  assert.match(duck.statusText, /Key NOT released/);

  const refund = entries.find((e) => e.kind === "refund");
  assert.equal(refund.statusText, "Refunded to wallet");
  assert.equal(summary.problems, 2);
});

test("UPI orders that failed after payment appear as problems; pending and expired do not", () => {
  const orders = [
    { id: 1, product_name: "Phantom", duration: "1 day", amount: "36", status: "delivery_failed", created_at: "2026-11-06T10:00:00Z" },
    { id: 2, product_name: "Phantom", duration: "1 day", amount: "36", status: "pending", created_at: "2026-11-06T10:05:00Z" },
    { id: 3, product_name: "Phantom", duration: "1 day", amount: "36", status: "expired", created_at: "2026-11-06T10:06:00Z" },
    { id: 4, product_name: "Duck", duration: "7 day", amount: "90", status: "processing", created_at: "2026-11-06T09:00:00Z" },
    { id: 5, product_name: "Duck", duration: "7 day", amount: "90", status: "processing", created_at: "2026-11-06T11:59:00Z" },
  ];
  const { entries } = buildUserLedger([], [], { orders, now: Date.parse("2026-11-06T12:00:00Z") });
  assert.equal(entries.length, 3);
  assert.equal(entries.find((e) => e.id === "o1").keyStatus, "not_released");
  assert.equal(entries.find((e) => e.id === "o4").keyStatus, "problem"); // stuck for hours
  assert.equal(entries.find((e) => e.id === "o5").keyStatus, "pending"); // only a minute old
});

test("missing times: wallet purchases still pair with history and take its date; top-ups recover time from deposit history", () => {
  const noTime = [
    { id: 1, type: "deposit", amount: 100, balance_after: 100, description: "Wallet Deposit", created_at: null },
    { id: 2, type: "purchase", amount: 35, balance_after: 65, description: "Purchase: Troll (3 Hour)", created_at: null },
    { id: 3, type: "purchase", amount: 35, balance_after: 30, description: "Purchase: Troll (3 Hour)", created_at: null },
  ];
  const history = [
    { id: 20, product_name: "Troll", duration: "3 Hour", price_paid: "35", key_code: "K-A", purchased_at: "2026-10-20T10:00:00Z" },
    { id: 21, product_name: "Troll", duration: "3 Hour", price_paid: "35", key_code: "K-B", purchased_at: "2026-10-20T10:30:00Z" },
  ];
  const deposits = [{ amount: "100", status: "success", created_at: "2026-10-19T09:00:00Z" }];
  const { entries } = buildUserLedger(noTime, history, { deposits });

  assert.equal(entries.length, 3);
  const buys = entries.filter((e) => e.kind === "wallet_purchase");
  assert.deepEqual(buys.map((e) => [e.keyText, e.balanceAfter]), [["K-B", 30], ["K-A", 65]]); // newest first, paired in order
  assert.ok(buys.every((e) => e.at && e.at.startsWith("2026-10-20")));
  const topup = entries.find((e) => e.kind === "deposit");
  assert.equal(topup.at, "2026-10-19T09:00:00.000Z");
});

test("rows with no recoverable time have at = null and sort last", () => {
  const rows = [
    { id: 1, type: "deposit", amount: 10, balance_after: 10, description: "x", created_at: null },
    { id: 2, type: "credit", amount: 5, balance_after: 15, description: "Admin added funds", created_at: "2026-11-01T00:00:00Z" },
  ];
  const { entries } = buildUserLedger(rows, []);
  assert.equal(entries[0].kind, "admin_credit");
  assert.equal(entries[1].at, null);
});

test("deposits, admin credits, refunds and orphan wallet purchases all appear, newest first", () => {
  const { entries, summary } = buildUserLedger(tx, purchases);
  assert.deepEqual(entries.map((e) => e.kind), [
    "wallet_purchase", "refund", "upi_purchase", "admin_credit", "wallet_purchase", "deposit",
  ]);
  assert.equal(summary.walletTopups, 500);
  assert.equal(summary.adminCredits, 50);
  assert.equal(summary.paidByUpi, 180);
  assert.equal(summary.refunds, 36);
  assert.equal(summary.spentFromWallet, 126);
});

test("two identical wallet purchases are matched one-to-one", () => {
  const twoTx = [
    { id: 1, type: "purchase", amount: 10, balance_after: 90, description: "Purchase: A (1 day)", created_at: "2026-11-01T10:00:00Z" },
    { id: 2, type: "purchase", amount: 10, balance_after: 80, description: "Purchase: A (1 day)", created_at: "2026-11-01T10:01:00Z" },
  ];
  const twoPurchases = [
    { id: 1, product_name: "A", duration: "1 day", price_paid: "10", key_code: "K1", purchased_at: "2026-11-01T10:00:01Z" },
    { id: 2, product_name: "A", duration: "1 day", price_paid: "10", key_code: "K2", purchased_at: "2026-11-01T10:01:01Z" },
  ];
  const { entries } = buildUserLedger(twoTx, twoPurchases);
  assert.deepEqual(entries.map((e) => e.balanceAfter), [80, 90]);
  assert.ok(entries.every((e) => e.method === "WALLET"));
});

test("a saved purchase without a key is flagged", () => {
  const { entries } = buildUserLedger([], [{ id: 1, product_name: "A", duration: "1 day", price_paid: "10", key_code: "", purchased_at: "2026-11-01T10:00:00Z" }]);
  assert.equal(entries[0].keyStatus, "problem");
});

test("empty history gives an empty ledger", () => {
  const { entries, summary } = buildUserLedger([], []);
  assert.equal(entries.length, 0);
  assert.equal(summary.purchases, 0);
});
