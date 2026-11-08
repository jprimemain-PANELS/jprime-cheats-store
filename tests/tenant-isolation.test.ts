import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, req } from "./helpers/env";

vi.mock("next/headers", async () => (await import("./helpers/env")).nextHeadersMock());
vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));
vi.mock("@/lib/telegram", () => ({ sendTelegramPurchase: async () => {} }));

import { tables, seed, rpcCalls } from "./helpers/fake-supabase";
import {
  buildWorld, loginAs, tokenFor, users,
  TENANT_B, TENANT_C, HOST_A, HOST_B, HOST_C,
} from "./helpers/world";
import { OWNER_TENANT_ID, resolveTenantByHost, clearTenantCache } from "@/lib/tenant";
import { getSessionUser, requireAdmin, requireTenantAdmin, requireUser, createSessionToken } from "@/lib/auth";
import { tdb } from "@/lib/tenant-db";

import { POST as login } from "@/app/api/auth/login/route";
import { POST as signup } from "@/app/api/auth/signup/route";
import { GET as getWallet } from "@/app/api/get-wallet/route";
import { POST as payViaWallet } from "@/app/api/pay-via-wallet/route";
import { GET as adminDataGet, POST as adminDataPost } from "@/app/api/admin/data/route";
import { POST as createUpiOrder } from "@/app/api/create-upi-order/route";
import { POST as createWalletOrder } from "@/app/api/create-wallet-order/route";
import { GET as recentActivity } from "@/app/api/recent-activity/route";
import { GET as publicCatalog } from "@/app/api/catalog/route";
import { GET as stockCount } from "@/app/api/stock-count/route";
import { GET as getPurchases } from "@/app/api/get-purchases/route";
import { GET as legacyProducts } from "@/app/api/admin/legacy-products/route";

beforeEach(() => {
  buildWorld();
  vi.unstubAllEnvs();
  vi.stubEnv("VERCEL_ENV", "production");
});

describe("host -> tenant resolution", () => {
  it("maps verified hosts to their tenant", async () => {
    expect((await resolveTenantByHost(HOST_A))?.id).toBe(OWNER_TENANT_ID);
    expect((await resolveTenantByHost(HOST_B))?.id).toBe(TENANT_B);
  });
  it("pending stores and unknown hosts do not resolve in production", async () => {
    expect(await resolveTenantByHost(HOST_C)).toBeNull();
    expect(await resolveTenantByHost("evil.example")).toBeNull();
  });
  it("a co-admin host never falls back to the owner, even outside production", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    clearTenantCache();
    expect(await resolveTenantByHost(HOST_C)).toBeNull(); // mapped but pending
    expect((await resolveTenantByHost("anything.vercel.app"))?.id).toBe(OWNER_TENANT_ID); // preview convenience
  });
  it("tenant id in a request body/query/header is ignored", async () => {
    loginAs("rajA", OWNER_TENANT_ID, "raj", HOST_A);
    const r = new (await import("next/server")).NextRequest(`https://${HOST_A}/api/get-wallet?tenant_id=${TENANT_B}`, {
      headers: { host: HOST_A, "x-tenant-id": TENANT_B, origin: `https://${HOST_A}` },
    });
    const res = await getWallet(r);
    expect((await res.json()).balance).toBe(1000); // owner store's raj, not B's 50
  });
});

describe("session binding", () => {
  it("a session issued for store A is rejected on store B and vice versa", async () => {
    ctx.host = HOST_B; ctx.cookie = tokenFor("rajA", OWNER_TENANT_ID, "raj");
    expect(await getSessionUser()).toBeNull();
    ctx.host = HOST_A; ctx.cookie = tokenFor("rajB", TENANT_B, "raj");
    expect(await getSessionUser()).toBeNull();
  });
  it("valid session works on its own store", async () => {
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    expect((await getSessionUser())?.tenantId).toBe(TENANT_B);
  });
  it("a token with a tampered tenant claim fails the signature", async () => {
    const good = tokenFor("rajA", OWNER_TENANT_ID, "raj");
    const [body, sig] = good.split(".");
    const forged = JSON.parse(Buffer.from(body, "base64url").toString());
    forged.t = TENANT_B;
    const evil = `${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${sig}`;
    ctx.host = HOST_B; ctx.cookie = evil;
    expect(await getSessionUser()).toBeNull();
  });
  it("a user id from another tenant cannot be smuggled in with a re-signed token", async () => {
    // Even a correctly signed token claiming tenant B but carrying owner user's id is rejected.
    ctx.host = HOST_B;
    ctx.cookie = createSessionToken("raj", users.rajA.password, users.rajA.id, TENANT_B);
    expect(await getSessionUser()).toBeNull();
  });
  it("legacy tokens without a tenant claim belong to the owner store only", async () => {
    const t = createSessionToken("raj", users.rajA.password, users.rajA.id); // default = owner
    const body = JSON.parse(Buffer.from(t.split(".")[0], "base64url").toString());
    expect(body.t).toBe(OWNER_TENANT_ID);
    ctx.host = HOST_B; ctx.cookie = t;
    expect(await getSessionUser()).toBeNull();
  });
});

describe("login and signup are per store", () => {
  it("same username, different passwords: each store accepts only its own", async () => {
    let res = await login(req("/api/auth/login", { method: "POST", host: HOST_B, body: { username: "raj", password: "pass-A" } }));
    expect(res.status).toBe(401);
    res = await login(req("/api/auth/login", { method: "POST", host: HOST_B, body: { username: "raj", password: "pass-B" } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("jp_session=");
    res = await login(req("/api/auth/login", { method: "POST", host: HOST_A, body: { username: "raj", password: "pass-B" } }));
    expect(res.status).toBe(401);
  });
  it("unknown / pending hosts cannot log in", async () => {
    const res = await login(req("/api/auth/login", { method: "POST", host: HOST_C, body: { username: "x", password: "y" } }));
    expect(res.status).toBe(404);
  });
  it("signup creates the user in the calling store and the name is free per store", async () => {
    const res = await signup(req("/api/auth/signup", { method: "POST", host: HOST_B, body: { username: "boss", password: "secret1", mobile_number: "9876543210" } }));
    expect(res.status).toBe(200); // 'boss' exists only in the owner store
    const row = tables.users.find((u) => u.username === "boss" && u.tenant_id === TENANT_B);
    expect(row?.role).toBe("user");
    const dup = await signup(req("/api/auth/signup", { method: "POST", host: HOST_B, body: { username: "raj", password: "secret1", mobile_number: "9876543210" } }));
    expect(dup.status).toBe(409);
  });
  it("a client-supplied role or tenant_id on signup is ignored", async () => {
    await signup(req("/api/auth/signup", { method: "POST", host: HOST_B, body: { username: "newbie", password: "secret1", mobile_number: "9876543210", role: "admin", tenant_id: OWNER_TENANT_ID } }));
    const row = tables.users.find((u) => u.username === "newbie")!;
    expect(row.role).toBe("user");
    expect(row.tenant_id).toBe(TENANT_B);
  });
});

describe("wallets are per store", () => {
  it("same username has independent balances", async () => {
    loginAs("rajA", OWNER_TENANT_ID, "raj", HOST_A);
    expect((await (await getWallet(req("/api/get-wallet"))).json()).balance).toBe(1000);
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    expect((await (await getWallet(req("/api/get-wallet"))).json()).balance).toBe(50);
    // every wallet RPC carried the tenant explicitly
    expect(rpcCalls.every((c) => c.name.startsWith("jprime_t_") && c.args.p_tenant)).toBe(true);
  });
  it("purchase history is per store", async () => {
    seed("purchase_history", [
      { tenant_id: OWNER_TENANT_ID, username: "raj", product_name: "P", key_code: "OWNER-KEY", created_at: "2026-01-01T00:00:00Z" },
      { tenant_id: TENANT_B, username: "raj", product_name: "Q", key_code: "B-KEY", created_at: "2026-01-01T00:00:00Z" },
    ]);
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    const j = await (await getPurchases(req("/api/get-purchases"))).json();
    expect(j.purchases.map((p: any) => p.key_code)).toEqual(["B-KEY"]);
  });
});

describe("purchases in a co-admin store", () => {
  const product = (supplier: string, price = "₹100") => ({
    tenant_id: TENANT_B, product_id: "p1", name: "Widget",
    data: { id: "p1", name: "Widget", status: "ONLINE", prices: [{ duration: "1 Day", priceINR: price, supplier }] },
  });

  it("cannot use the owner's seller API credentials (fails closed, refunds, never calls the supplier)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.stubEnv("RESELLER_API_KEY", "owner-key"); vi.stubEnv("RESELLER_MASTER_KEY", "owner-master"); vi.stubEnv("SELLER2_API_TOKEN", "owner-token");
    seed("products_catalog", [product("SELLER1", "₹10")]); // affordable: raj has 50, so the purchase reaches delivery
    seed("wallets", [{ tenant_id: TENANT_B, username: "andrew", balance: 0 }]);
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    const res = await payViaWallet(req("/api/pay-via-wallet", { method: "POST", body: { product_name: "Widget", duration: "1 Day" } }));
    expect(res.status).toBe(502);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(tables.wallets.find((w) => w.tenant_id === TENANT_B && w.username === "raj")!.balance).toBe(50); // refunded
    expect(tables.purchase_history ?? []).toHaveLength(0);
  });

  it("delivers from its OWN stock only and never touches the owner's stock", async () => {
    seed("products_catalog", [{ ...product("LOCAL"), data: { ...product("LOCAL").data, prices: [{ duration: "1 Day", priceINR: "₹10", supplier: "LOCAL" }] } }]);
    seed("stock_keys", [
      { tenant_id: OWNER_TENANT_ID, product_name: "Widget", duration: "1 Day", key_code: "OWNER-STOCK", is_used: false },
    ]);
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    // B has no stock of its own -> must NOT receive the owner's key
    let res = await payViaWallet(req("/api/pay-via-wallet", { method: "POST", body: { product_name: "Widget", duration: "1 Day" } }));
    expect(res.status).toBe(502);
    expect(tables.stock_keys[0].is_used).toBe(false);
    // add B's own stock -> delivered, recorded under B
    seed("stock_keys", [{ tenant_id: TENANT_B, product_name: "Widget", duration: "1 Day", key_code: "B-STOCK", is_used: false }]);
    res = await payViaWallet(req("/api/pay-via-wallet", { method: "POST", body: { product_name: "Widget", duration: "1 Day" } }));
    const j = await res.json();
    expect(j.key).toBe("B-STOCK");
    expect(j.newBalance).toBe(40);
    expect(tables.purchase_history.at(-1)).toMatchObject({ tenant_id: TENANT_B, username: "raj" });
    expect(tables.wallet_transactions.every((t) => t.tenant_id === TENANT_B)).toBe(true);
    expect(tables.stock_keys.find((k) => k.key_code === "OWNER-STOCK")!.is_used).toBe(false);
  });

  it("the owner's built-in legacy product list is not sold by a co-admin store", async () => {
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    const res = await payViaWallet(req("/api/pay-via-wallet", { method: "POST", body: { product_name: "Any Legacy Product", duration: "1 Day" } }));
    expect([404, 409]).toContain(res.status);
  });

  it("a suspended store accepts no new purchases, deposits or orders but keeps its data", async () => {
    tables.tenants.find((t) => t.id === TENANT_B)!.status = "suspended";
    clearTenantCache();
    seed("products_catalog", [product("LOCAL")]);
    loginAs("rajB", TENANT_B, "raj", HOST_B); // login/session still works
    expect(await getSessionUser()).not.toBeNull();
    for (const [fn, path, body] of [
      [payViaWallet, "/api/pay-via-wallet", { product_name: "Widget", duration: "1 Day" }],
      [createUpiOrder, "/api/create-upi-order", { product_name: "Widget", duration: "1 Day" }],
      [createWalletOrder, "/api/create-wallet-order", { amount: 100, mobile_number: "9999999999" }],
    ] as const) {
      const res = await (fn as any)(req(path, { method: "POST", body }));
      expect(res.status).toBe(403);
    }
    expect(tables.wallets.find((w) => w.tenant_id === TENANT_B)!.balance).toBe(50);
  });

  it("payment gateway routes fail closed for co-admin stores until Phase 4", async () => {
    seed("products_catalog", [product("LOCAL")]);
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    expect((await createUpiOrder(req("/api/create-upi-order", { method: "POST", body: { product_name: "Widget", duration: "1 Day" } }))).status).toBe(503);
    expect((await createWalletOrder(req("/api/create-wallet-order", { method: "POST", body: { amount: 100, mobile_number: "9999999999" } }))).status).toBe(503);
  });
});

describe("roles and the permission matrix", () => {
  it("owner admin passes requireAdmin on the owner store", async () => {
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    expect((await requireAdmin(req("/x"))).ok).toBe(true);
    expect((await requireTenantAdmin(req("/x"))).ok).toBe(true);
  });
  it("co-admin is admin of their own store only; never owner", async () => {
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    expect((await requireAdmin(req("/x"))).ok).toBe(false);
    expect((await requireTenantAdmin(req("/x"))).ok).toBe(true);
    // and their session is worthless on the owner host
    ctx.host = HOST_A;
    expect((await requireTenantAdmin(req("/x", { host: HOST_A }))).ok).toBe(false);
  });
  it("role 'admin' inside a co-admin store grants nothing (not owner, not co-admin)", async () => {
    loginAs("fakeAdminB", TENANT_B, "sneaky", HOST_B);
    expect((await requireAdmin(req("/x"))).ok).toBe(false);
    expect((await requireTenantAdmin(req("/x"))).ok).toBe(false);
  });
  it("customers and resellers are not admins", async () => {
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    expect((await requireTenantAdmin(req("/x"))).ok).toBe(false);
    expect((await requireUser(req("/x"))).ok).toBe(true);
  });
  it("owner-only routes reject co-admins", async () => {
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    expect((await legacyProducts(req("/api/admin/legacy-products"))).status).toBe(403);
  });
});

describe("store admin data is scoped", () => {
  it("co-admin sees only their store's users, wallets and stock", async () => {
    seed("stock_keys", [
      { tenant_id: OWNER_TENANT_ID, product_name: "P", duration: "1", key_code: "OWNER-K", is_used: false },
      { tenant_id: TENANT_B, product_name: "P", duration: "1", key_code: "B-K", is_used: false },
    ]);
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    const j = await (await adminDataGet(req("/api/admin/data"))).json();
    expect(j.success).toBe(true);
    expect(j.users.every((u: any) => u.tenant_id === TENANT_B)).toBe(true);
    expect(j.users.some((u: any) => u.username === "boss")).toBe(false);
    expect(j.keys.map((k: any) => k.key_code)).toEqual(["B-K"]);
    expect(j.wallets).toEqual([{ tenant_id: TENANT_B, username: "raj", balance: 50, id: expect.any(String) }].map((w) => expect.objectContaining({ username: "raj", balance: 50 })));
    expect(JSON.stringify(j)).not.toContain("scrypt$"); // password hashes never returned
  });
  it("co-admin cannot act on a user of another store by id", async () => {
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    const res = await adminDataPost(req("/api/admin/data", { method: "POST", body: { action: "update_user", userId: users.rajA.id, role: "reseller", balanceAction: "add", amount: 999 } }));
    expect(res.status).toBe(404);
    expect(tables.wallets.find((w) => w.tenant_id === OWNER_TENANT_ID)!.balance).toBe(1000);
    expect(tables.users.find((u) => u.id === users.rajA.id)!.role).toBe("user");
  });
  it("co-admin can credit their own customer and the ledger is stamped with their tenant", async () => {
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    const res = await adminDataPost(req("/api/admin/data", { method: "POST", body: { action: "update_user", userId: users.rajB.id, balanceAction: "add", amount: 25 } }));
    expect(res.status).toBe(200);
    expect(tables.wallets.find((w) => w.tenant_id === TENANT_B && w.username === "raj")!.balance).toBe(75);
    expect(tables.wallet_transactions.at(-1)).toMatchObject({ tenant_id: TENANT_B, username: "raj" });
  });
  it("co-admin cannot mint admins or co-admins", async () => {
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    for (const role of ["admin", "coadmin"]) {
      const res = await adminDataPost(req("/api/admin/data", { method: "POST", body: { action: "update_user", userId: users.rajB.id, role } }));
      expect(res.status).toBe(400);
    }
    expect(tables.users.find((u) => u.id === users.rajB.id)!.role).toBe("user");
  });
  it("stock added by a co-admin is stamped with their tenant even if the body claims another", async () => {
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    await adminDataPost(req("/api/admin/data", { method: "POST", body: { action: "add_stock", product_name: "P", duration: "1", keys: ["k1"], tenant_id: OWNER_TENANT_ID } }));
    expect(tables.stock_keys.find((k) => k.key_code === "k1")!.tenant_id).toBe(TENANT_B);
  });
  it("owner admin on the owner store sees only the owner store here (cross-tenant view is a separate owner route)", async () => {
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    const j = await (await adminDataGet(req("/api/admin/data"))).json();
    expect(j.users.every((u: any) => u.tenant_id === OWNER_TENANT_ID)).toBe(true);
  });
});

describe("public + activity endpoints are per store", () => {
  it("catalog: co-admin store starts empty and never shows the owner's legacy list", async () => {
    ctx.host = HOST_B;
    const j = await (await publicCatalog()).json();
    expect(j.products).toEqual([]);
    ctx.host = HOST_A;
    expect((await (await publicCatalog()).json()).products.length).toBeGreaterThan(0); // owner legacy fallback intact
  });
  it("stock count is per store", async () => {
    seed("stock_keys", [
      { tenant_id: OWNER_TENANT_ID, product_name: "P", duration: "1", key_code: "a", is_used: false },
      { tenant_id: OWNER_TENANT_ID, product_name: "P", duration: "1", key_code: "b", is_used: false },
      { tenant_id: TENANT_B, product_name: "P", duration: "1", key_code: "c", is_used: false },
    ]);
    ctx.host = HOST_B;
    const r = new (await import("next/server")).NextRequest(`https://${HOST_B}/api/stock-count?product=P&duration=1`, { headers: { host: HOST_B } });
    expect((await (await stockCount(r)).json()).count).toBe(1);
  });
  it("recent activity shows only the caller's store, masked, with no private fields", async () => {
    seed("wallet_transactions", [
      { tenant_id: OWNER_TENANT_ID, username: "ownercustomer", type: "deposit", amount: "500", description: "Wallet Deposit Verification Successful", created_at: "2026-10-01T10:00:00Z" },
      { tenant_id: TENANT_B, username: "bcustomer", type: "deposit", amount: "200", description: "Wallet Deposit Verification Successful", created_at: "2026-10-01T09:00:00Z" },
      { tenant_id: TENANT_B, username: "badmincredit", type: "credit", amount: "999", description: "Admin added funds", created_at: "2026-10-01T09:30:00Z" },
    ]);
    seed("purchase_history", [
      { tenant_id: OWNER_TENANT_ID, username: "ownercustomer", product_name: "OwnerProduct", duration: "1 Day", key_code: "SECRET-OWNER", price_paid: "100", created_at: "2026-10-01T10:05:00Z" },
      { tenant_id: TENANT_B, username: "bcustomer", product_name: "BProduct", duration: "1 Day", key_code: "SECRET-B", price_paid: "50", created_at: "2026-10-01T09:05:00Z" },
    ]);
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    const j = await (await recentActivity(req("/api/recent-activity"))).json();
    const text = JSON.stringify(j);
    expect(j.events).toHaveLength(2);
    expect(text).toContain("bc***");
    expect(text).not.toContain("ownercustomer");
    expect(text).not.toContain("OwnerProduct");
    expect(text).not.toContain("SECRET");
    expect(text).not.toContain("999"); // admin credit excluded
    // per-tenant cache: owner now sees owner data, not B's cached feed
    loginAs("rajA", OWNER_TENANT_ID, "raj", HOST_A);
    const o = await (await recentActivity(req("/api/recent-activity"))).json();
    expect(JSON.stringify(o)).toContain("ow***");
    expect(JSON.stringify(o)).not.toContain("BProduct");
  });
});

describe("tenantDb guarantees", () => {
  it("rejects non-uuid tenant ids and non-tenant tables", () => {
    expect(() => tdb("not-a-uuid")).toThrow();
    expect(() => tdb(OWNER_TENANT_ID).from("tenants" as any)).toThrow();
  });
  it("update cannot move a row to another tenant", async () => {
    seed("users", [{ id: "u-x", tenant_id: TENANT_B, username: "z", role: "user" }]);
    await tdb(TENANT_B).from("users").update({ tenant_id: OWNER_TENANT_ID, role: "reseller" }).eq("id", "u-x");
    expect(tables.users.find((u) => u.id === "u-x")).toMatchObject({ tenant_id: TENANT_B, role: "reseller" });
  });
  it("update/delete from tenant A never touches tenant B rows", async () => {
    seed("stock_keys", [{ id: "k-b", tenant_id: TENANT_B, key_code: "kb", is_used: false }]);
    await tdb(OWNER_TENANT_ID).from("stock_keys").update({ is_used: true }).eq("id", "k-b");
    await tdb(OWNER_TENANT_ID).from("stock_keys").delete().eq("id", "k-b");
    expect(tables.stock_keys.find((k) => k.id === "k-b")).toMatchObject({ is_used: false });
  });
});
