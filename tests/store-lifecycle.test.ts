import { beforeEach, describe, expect, it, vi } from "vitest";
import { req } from "./helpers/env";

vi.mock("next/headers", async () => (await import("./helpers/env")).nextHeadersMock());
vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));
vi.mock("@/lib/telegram", () => ({ sendTelegramPurchase: async () => {} }));

import { tables, seed } from "./helpers/fake-supabase";
import { buildWorld, loginAs, HOST_A, HOST_B, TENANT_B } from "./helpers/world";
import { OWNER_TENANT_ID, resolveTenantByHost, clearTenantCache } from "@/lib/tenant";
import { movedTo } from "@/lib/domains";
import { POST as tenantsPost } from "@/app/api/admin/tenants/route";

const post = (host: string, body: any) => tenantsPost(req("/api/admin/tenants", { method: "POST", body, host }));
beforeEach(() => { buildWorld(); clearTenantCache(); });

describe("delete store", () => {
  it("needs the exact name, removes the addresses so the website stops working, keeps the main store safe", async () => {
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    const slug = (tables.tenants.find((t) => t.id === TENANT_B) as any).slug;
    expect((await post(HOST_A, { action: "delete_store", id: TENANT_B, confirm: "nope" })).status).toBe(400);
    expect(await resolveTenantByHost(HOST_B)).not.toBeNull();
    expect((await post(HOST_A, { action: "delete_store", id: TENANT_B, confirm: slug })).status).toBe(200);
    expect((tables.tenants.find((t) => t.id === TENANT_B) as any).slug).toMatch(/^deleted-/);
    expect(tables.tenant_domains.filter((d) => d.tenant_id === TENANT_B)).toHaveLength(0);
    expect((await post(HOST_A, { action: "delete_store", id: OWNER_TENANT_ID, confirm: "x" })).status).toBe(400);
  });
  it("a store admin cannot delete stores", async () => {
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    expect([401, 403]).toContain((await post(HOST_B, { action: "delete_store", id: TENANT_B, confirm: "x" })).status);
  });
});

describe("old free address after upgrading to an own domain", () => {
  it("shows the moved page only on the old address", async () => {
    expect(await movedTo(TENANT_B, HOST_B)).toBeNull();
    seed("tenant_domains", [{ host: "shop.rajstore.com", tenant_id: TENANT_B, verified: true, kind: "custom" }]);
    expect(await movedTo(TENANT_B, "other-old.jprimecheats.store")).toBe("shop.rajstore.com");
    expect(await movedTo(TENANT_B, "shop.rajstore.com")).toBeNull();
  });
});
