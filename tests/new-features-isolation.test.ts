import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, req } from "./helpers/env";

vi.mock("next/headers", async () => (await import("./helpers/env")).nextHeadersMock());
vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));
vi.mock("@/lib/telegram", () => ({ sendTelegramPurchase: async () => {} }));

import { tables, seed } from "./helpers/fake-supabase";
import { buildWorld, loginAs, HOST_A, HOST_B, TENANT_B } from "./helpers/world";
import { OWNER_TENANT_ID } from "@/lib/tenant";
import { settingKey } from "@/lib/tenant-db";
import { COUPONS_KEY } from "@/lib/coupons";

import { POST as couponsPost, GET as couponsGet } from "@/app/api/admin/coupons/route";
import { GET as publicCoupons } from "@/app/api/coupons/public/route";
import { GET as ledger } from "@/app/api/admin/user-ledger/route";
import { POST as vipBulk } from "@/app/api/admin/vip-bulk/route";
import { GET as priceBook } from "@/app/api/admin/price-book/route";
import { claimLocalStockKey, countLocalStock } from "@/lib/stock";

beforeEach(() => buildWorld());

const coupon = { action: "save", code: "OWNER10", percent: 10, scope: "all", products: [], enabled: true, startsAt: null, endsAt: null };

describe("coupons are per store", () => {
  it("owner and co-admin keep separate coupon lists under separate keys", async () => {
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    expect((await couponsPost(req("/api/admin/coupons", { method: "POST", host: HOST_A, body: coupon }))).status).toBe(200);
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    expect((await couponsPost(req("/api/admin/coupons", { method: "POST", host: HOST_B, body: { ...coupon, code: "STOREB20", percent: 20 } }))).status).toBe(200);

    const keys = tables.app_settings.map((r) => r.key).sort();
    expect(keys).toEqual([COUPONS_KEY, settingKey(TENANT_B, COUPONS_KEY)].sort());

    const bList = await (await couponsGet(req("/api/admin/coupons", { host: HOST_B }))).json();
    expect(JSON.stringify(bList)).toContain("STOREB20");
    expect(JSON.stringify(bList)).not.toContain("OWNER10");

    ctx.host = HOST_A; ctx.cookie = "";
    const pubA = await (await publicCoupons()).json();
    ctx.host = HOST_B;
    const pubB = await (await publicCoupons()).json();
    expect(pubA.all).toEqual([10]);
    expect(pubB.all).toEqual([20]);
  });
  it("customers and anonymous users cannot read or write coupons", async () => {
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    expect((await couponsGet(req("/api/admin/coupons", { host: HOST_B }))).status).toBe(403);
    expect((await couponsPost(req("/api/admin/coupons", { method: "POST", host: HOST_B, body: coupon }))).status).toBe(403);
  });
});

describe("stock helpers are per store", () => {
  it("count and claim only see the store's own keys", async () => {
    seed("stock_keys", [
      { id: 1, tenant_id: OWNER_TENANT_ID, product_name: "Phantom", duration: "1 day", key_code: "OWNER-KEY", is_used: false },
      { id: 2, tenant_id: TENANT_B, product_name: "Phantom", duration: "1 day", key_code: "B-KEY", is_used: false },
    ]);
    expect(await countLocalStock(TENANT_B, "Phantom", "1 day", { fresh: true })).toEqual({ ok: true, data: 1 });
    const c = await claimLocalStockKey(TENANT_B, "Phantom", "1 day");
    expect(c).toEqual({ status: "ok", key: "B-KEY" });
    expect(await claimLocalStockKey(TENANT_B, "Phantom", "1 day")).toEqual({ status: "empty" });
    expect(tables.stock_keys.find((k) => k.id === 1)?.is_used).toBe(false); // owner's key untouched
  });
});

describe("ledger / bulk / price book", () => {
  it("co-admin ledger for a username that also exists in the owner store shows only their own rows", async () => {
    seed("wallet_transactions", [
      { id: 1, tenant_id: OWNER_TENANT_ID, username: "raj", type: "deposit", amount: 999, balance_after: 999, description: "OWNER-SECRET", created_at: "2026-01-01T00:00:00Z" },
      { id: 2, tenant_id: TENANT_B, username: "raj", type: "deposit", amount: 5, balance_after: 5, description: "B-ROW", created_at: "2026-01-02T00:00:00Z" },
    ]);
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    const txt = await (await ledger(req("/api/admin/user-ledger?username=raj", { host: HOST_B }))).text();
    const j = JSON.parse(txt);
    expect(j.entries.map((e: any) => e.amount)).toEqual([5]); // only store B's row; the owner's 999 is invisible
  });
  it("vip-bulk 'ALL' resellers never includes another store's resellers", async () => {
    seed("users", [
      { id: "ra", tenant_id: OWNER_TENANT_ID, username: "ownerReseller", role: "reseller", password: "x" },
      { id: "rb", tenant_id: TENANT_B, username: "bReseller", role: "reseller", password: "x" },
    ]);
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    const r = await vipBulk(req("/api/admin/vip-bulk", { method: "POST", host: HOST_B, body: { action: "reset", usernames: ["ownerReseller"], scope: { type: "all" } } }));
    expect(r.status).toBe(400); // "Not a reseller": invisible to this store
    expect(await r.text()).not.toMatch(/ownerReseller.*(found|exists)/);
  });
  it("price book and bulk tools are not available to customers", async () => {
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    expect((await priceBook(req("/api/admin/price-book", { host: HOST_B }))).status).toBe(403);
    expect((await ledger(req("/api/admin/user-ledger?username=raj", { host: HOST_B }))).status).toBe(403);
  });
});
