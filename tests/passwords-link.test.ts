import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, req } from "./helpers/env";

vi.mock("next/headers", async () => (await import("./helpers/env")).nextHeadersMock());
vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));
vi.mock("@/lib/telegram", () => ({ sendTelegramPurchase: async () => {} }));

import { tables } from "./helpers/fake-supabase";
import { buildWorld, loginAs, HOST_A, HOST_B, TENANT_B } from "./helpers/world";
import { OWNER_TENANT_ID } from "@/lib/tenant";
import { verifyPassword } from "@/lib/auth";
import { POST as changePw } from "@/app/api/auth/change-password/route";
import { POST as forgot } from "@/app/api/auth/forgot/route";
import { POST as resetRoute } from "@/app/api/auth/reset/route";
import { POST as dataPost } from "@/app/api/admin/data/route";
import { POST as tenantsPost } from "@/app/api/admin/tenants/route";
import { POST as subPost, GET as subGet } from "@/app/api/admin/subscription/route";
import { jprimeAccess } from "@/lib/api-system";

const post = (fn: any, path: string, host: string, body: any) => fn(req(path, { method: "POST", body, host }));
const user = (id: string) => tables.users.find((u) => u.id === id) as any;
beforeEach(() => { buildWorld(); tables.audit_log = []; });

describe("change password (everyone)", () => {
  it("needs the right current password, 8+ chars, then the new one works", async () => {
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    expect((await post(changePw, "/api/auth/change-password", HOST_B, { current: "nope", next: "newpass-123" })).status).toBe(400);
    expect((await post(changePw, "/api/auth/change-password", HOST_B, { current: "pass-B", next: "short" })).status).toBe(400);
    const r = await post(changePw, "/api/auth/change-password", HOST_B, { current: "pass-B", next: "newpass-123" });
    expect(r.status).toBe(200);
    expect(verifyPassword("newpass-123", user("user-rajB").password)).toBe(true);
    expect(verifyPassword("pass-B", user("user-rajB").password)).toBe(false);
    // the other store's user with the same name is untouched
    expect(verifyPassword("pass-A", user("user-rajA").password)).toBe(true);
  });
  it("anonymous is refused", async () => {
    ctx.cookie = ""; ctx.host = HOST_B;
    expect((await post(changePw, "/api/auth/change-password", HOST_B, { current: "a", next: "newpass-123" })).status).toBe(401);
  });
});

describe("admin reset + forgot request", () => {
  it("store admin resets a customer in ITS store only, gets a one-time password; admins cannot be reset", async () => {
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    const r = await post(dataPost, "/api/admin/data", HOST_B, { action: "reset_password", userId: "user-rajB" });
    const j = await r.json();
    expect(r.status).toBe(200); expect(j.password).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(verifyPassword(j.password, user("user-rajB").password)).toBe(true);
    // another store's user id cannot be reached
    expect((await post(dataPost, "/api/admin/data", HOST_B, { action: "reset_password", userId: "user-rajA" })).status).toBe(404);
    expect((await post(dataPost, "/api/admin/data", HOST_B, { action: "reset_password", userId: "user-fakeAdminB" })).status).toBe(403);
    expect((await post(dataPost, "/api/admin/data", HOST_B, { action: "reset_password", userId: "user-coadminB" })).status).toBe(400);
  });
  it("forgot is always the same answer, notes the request only for real users, and the admin sees it", async () => {
    ctx.cookie = ""; 
    expect((await post(forgot, "/api/auth/forgot", HOST_B, { username: "raj" })).status).toBe(200);
    expect((await post(forgot, "/api/auth/forgot", HOST_B, { username: "ghost" })).status).toBe(200);
    expect(tables.audit_log.filter((a: any) => a.action === "password.requested")).toHaveLength(1);
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    expect((await (await post(dataPost, "/api/admin/data", HOST_B, { action: "password_requests" })).json()).users).toEqual(["raj"]);
    await post(dataPost, "/api/admin/data", HOST_B, { action: "reset_password", userId: "user-rajB" });
    expect((await (await post(dataPost, "/api/admin/data", HOST_B, { action: "password_requests" })).json()).users).toEqual([]);
  });
  it("owner can reset a store admin's password; a store cannot call it", async () => {
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    expect([401, 403]).toContain((await post(tenantsPost, "/api/admin/tenants", HOST_B, { action: "reset_store_admin", id: TENANT_B })).status);
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    const r = await post(tenantsPost, "/api/admin/tenants", HOST_A, { action: "reset_store_admin", id: TENANT_B });
    const j = await r.json();
    expect(r.status).toBe(200); expect(j.username).toBe("andrew");
    expect(verifyPassword(j.password, user("user-coadminB").password)).toBe(true);
  });
});

describe("store links its own main-site wallet account", () => {
  it("checks the main-site password, refuses admins, then JPRIME API stock is available automatically", async () => {
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    expect((await jprimeAccess(TENANT_B)).allowed).toBe(false);
    expect((await post(subPost, "/api/admin/subscription", HOST_B, { action: "link", username: "raj", password: "wrong" })).status).toBe(400);
    expect((await post(subPost, "/api/admin/subscription", HOST_B, { action: "link", username: "boss", password: "pass-boss" })).status).toBe(400); // admin
    expect((await post(subPost, "/api/admin/subscription", HOST_B, { action: "link", username: "raj", password: "pass-A" })).status).toBe(200);
    expect(await jprimeAccess(TENANT_B)).toEqual({ allowed: true, payer: "raj" });
    const j = await (await subGet(req("/api/admin/subscription", { host: HOST_B }))).json();
    expect(j.payer).toBe("raj"); expect(j.walletBalance).toBe(1000);
  });
});

describe("forgot password with a code, and admin create account", () => {
  it("code flow: admin issues once, wrong code fails, right code sets the password, code cannot be reused", async () => {
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    const j = await (await post(dataPost, "/api/admin/data", HOST_B, { action: "reset_code", userId: "user-rajB" })).json();
    expect(j.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect((await post(dataPost, "/api/admin/data", HOST_B, { action: "reset_code", userId: "user-rajA" })).status).toBe(404);
    expect((await post(dataPost, "/api/admin/data", HOST_B, { action: "reset_code", userId: "user-fakeAdminB" })).status).toBe(403);
    ctx.cookie = "";
    expect((await post(resetRoute, "/api/auth/reset", HOST_B, { username: "raj", code: "AAAA-BBBB", password: "brandnew-123" })).status).toBe(400);
    expect((await post(resetRoute, "/api/auth/reset", HOST_B, { username: "raj", code: j.code, password: "short" })).status).toBe(400);
    expect((await post(resetRoute, "/api/auth/reset", HOST_B, { username: "raj", code: j.code, password: "brandnew-123" })).status).toBe(200);
    expect(verifyPassword("brandnew-123", user("user-rajB").password)).toBe(true);
    expect(verifyPassword("pass-A", user("user-rajA").password)).toBe(true);
    expect((await post(resetRoute, "/api/auth/reset", HOST_B, { username: "raj", code: j.code, password: "another-pass-9" })).status).toBe(400);
  });
  it("a code from one store never works in another store", async () => {
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    const j = await (await post(dataPost, "/api/admin/data", HOST_B, { action: "reset_code", userId: "user-rajB" })).json();
    ctx.cookie = "";
    expect((await post(resetRoute, "/api/auth/reset", HOST_A, { username: "raj", code: j.code, password: "brandnew-123" })).status).toBe(400);
    expect(verifyPassword("pass-A", user("user-rajA").password)).toBe(true);
  });
  it("mobile match marks the request verified", async () => {
    user("user-rajB").mobile_number = "98765 43210";
    ctx.cookie = "";
    await post(forgot, "/api/auth/forgot", HOST_B, { username: "raj", mobile: "+91 9876543210" });
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    const j = await (await post(dataPost, "/api/admin/data", HOST_B, { action: "password_requests" })).json();
    expect(j.users).toEqual(["raj"]); expect(j.verified).toEqual(["raj"]);
  });
  it("create account: hashed password, role limits, duplicate refused, starting balance credited", async () => {
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    const ok = await post(dataPost, "/api/admin/data", HOST_B, { action: "create_user", username: "newbie", password: "secret1", role: "reseller", balance: 150 });
    expect(ok.status).toBe(200);
    const row = tables.users.find((u: any) => u.username === "newbie" && u.tenant_id === TENANT_B) as any;
    expect(row.role).toBe("reseller"); expect(row.password).not.toBe("secret1"); expect(verifyPassword("secret1", row.password)).toBe(true);
    expect((await post(dataPost, "/api/admin/data", HOST_B, { action: "create_user", username: "newbie", password: "secret1", role: "user" })).status).toBe(409);
    expect((await post(dataPost, "/api/admin/data", HOST_B, { action: "create_user", username: "boss2", password: "secret1", role: "admin" })).status).toBe(400);
    expect((await post(dataPost, "/api/admin/data", HOST_B, { action: "create_user", username: "bad name", password: "secret1", role: "user" })).status).toBe(400);
    expect((await post(dataPost, "/api/admin/data", HOST_B, { action: "create_user", username: "okname", password: "123", role: "user" })).status).toBe(400);
    expect(tables.users.find((u: any) => u.username === "newbie" && u.tenant_id !== TENANT_B)).toBeUndefined();
  });
});
