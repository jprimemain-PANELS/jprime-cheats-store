import { hashPassword, createSessionToken } from "@/lib/auth";
import { OWNER_TENANT_ID, clearTenantCache } from "@/lib/tenant";
import { resetDb, seed } from "./fake-supabase";
import { ctx } from "./env";

export const TENANT_B = "00000000-0000-0000-0000-0000000000b2";
export const TENANT_C = "00000000-0000-0000-0000-0000000000c3";
export const HOST_A = "jprimecheats.store";
export const HOST_B = "andrews.store-b.example";
export const HOST_C = "pending.store-c.example";

export const users: Record<string, { id: string; password: string }> = {};

/** Two stores that BOTH have a user called "raj" with different passwords/balances. */
export function buildWorld() {
  resetDb();
  clearTenantCache();
  ctx.host = HOST_A;
  ctx.cookie = "";

  seed("tenants", [
    { id: OWNER_TENANT_ID, slug: "jprime", kind: "owner", status: "active", brand_name: "JPRIME STORE", inventory_mode: "own_api", shared_stock_allowed: true },
    { id: TENANT_B, slug: "andrews", kind: "coadmin", status: "active", brand_name: "Andrews", inventory_mode: "own_api", shared_stock_allowed: false },
    { id: TENANT_C, slug: "pending", kind: "coadmin", status: "pending", brand_name: "Pending", inventory_mode: "own_api", shared_stock_allowed: false },
  ]);
  seed("tenant_domains", [
    { host: HOST_A, tenant_id: OWNER_TENANT_ID, verified: true },
    { host: HOST_B, tenant_id: TENANT_B, verified: true },
    { host: HOST_C, tenant_id: TENANT_C, verified: true },
  ]);

  const mk = (key: string, tenant_id: string, username: string, role: string, pw: string) => {
    const password = hashPassword(pw);
    const id = `user-${key}`;
    seed("users", [{ id, tenant_id, username, role, password, email: `${key}@x.test`, mobile_number: "9999999999" }]);
    users[key] = { id, password };
    return id;
  };
  mk("rajA", OWNER_TENANT_ID, "raj", "user", "pass-A");
  mk("rajB", TENANT_B, "raj", "user", "pass-B");
  mk("ownerAdmin", OWNER_TENANT_ID, "boss", "admin", "pass-boss");
  mk("coadminB", TENANT_B, "andrew", "coadmin", "pass-andrew");
  // a user inside store B who was (wrongly) given role "admin": must NOT become owner
  mk("fakeAdminB", TENANT_B, "sneaky", "admin", "pass-sneaky");

  seed("wallets", [
    { tenant_id: OWNER_TENANT_ID, username: "raj", balance: 1000 },
    { tenant_id: TENANT_B, username: "raj", balance: 50 },
  ]);
}

export function tokenFor(userKey: string, tenantId: string, username: string) {
  return createSessionToken(username, users[userKey].password, users[userKey].id, tenantId);
}

export function loginAs(userKey: string, tenantId: string, username: string, host: string) {
  ctx.host = host;
  ctx.cookie = tokenFor(userKey, tenantId, username);
}
