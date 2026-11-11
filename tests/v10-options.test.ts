import { beforeEach, describe, expect, it, vi } from "vitest";
import { req } from "./helpers/env";

vi.mock("next/headers", async () => (await import("./helpers/env")).nextHeadersMock());
vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));
vi.mock("@/lib/telegram", () => ({ sendTelegramPurchase: async () => {} }));

import { tables, seed } from "./helpers/fake-supabase";
import { buildWorld, loginAs, HOST_A, HOST_B, TENANT_B } from "./helpers/world";
import { OWNER_TENANT_ID, clearTenantCache, resolveTenantByHost } from "@/lib/tenant";
import { getStoreOptions } from "@/lib/store-options";
import { linkWalletAccount, verifyMainAccount } from "@/lib/subscription";
import { deleteStore } from "@/lib/domains";
import { GET as optGet, POST as optPost } from "@/app/api/admin/store-options/route";
import { POST as tenantsPost } from "@/app/api/admin/tenants/route";
import { GET as applyGet } from "@/app/api/tenant/apply/route";

const tpost = (host: string, body: any) => tenantsPost(req("/api/admin/tenants", { method: "POST", body, host }));
const opost = (host: string, body: any) => optPost(req("/api/admin/store-options", { method: "POST", body, host }));
beforeEach(() => { buildWorld(); clearTenantCache(); });

describe("store options (tutorial + upgrade)", () => {
  it("each store has its own options; a co-admin cannot touch the owner's or enable resellerLaunch", async () => {
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    const r = await opost(HOST_B, { tutorialOn: true, tutorialUrl: "https://youtu.be/abcdefghijk", upgradeOn: true, upgradePrice: 150, resellerLaunch: true });
    expect(r.status).toBe(200);
    const b = await getStoreOptions(TENANT_B);
    expect(b).toMatchObject({ tutorialOn: true, upgradeOn: true, upgradePrice: 150, resellerLaunch: false });
    const owner = await getStoreOptions(OWNER_TENANT_ID);
    expect(owner.upgradeOn).toBe(false);
    expect(owner.upgradePrice).toBe(99);
  });
  it("rejects non-YouTube / non-https links and bad prices", async () => {
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    expect((await opost(HOST_B, { tutorialOn: true, tutorialUrl: "javascript:alert(1)", upgradePrice: 99 })).status).toBe(400);
    expect((await opost(HOST_B, { tutorialOn: false, tutorialUrl: "", upgradeOn: true, upgradePrice: 0 })).status).toBe(400);
  });
  it("normal users cannot read or write options", async () => {
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    expect([401, 403]).toContain((await opost(HOST_B, { upgradePrice: 10 })).status);
    expect([401, 403]).toContain((await optGet(req("/api/admin/store-options", { host: HOST_B }))).status);
  });
});

describe("ban / unban / reseller_launch (owner only)", () => {
  it("owner can ban: tenant resolves as not active; unban restores", async () => {
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    expect((await tpost(HOST_A, { action: "ban", id: TENANT_B })).status).toBe(200);
    clearTenantCache();
    const t: any = await resolveTenantByHost(HOST_B);
    expect(t.banned).toBe(true);
    expect(t.status).not.toBe("active");
    expect((await tpost(HOST_A, { action: "unban", id: TENANT_B })).status).toBe(200);
    clearTenantCache();
    expect(((await resolveTenantByHost(HOST_B)) as any).status).toBe("active");
  });
  it("the main store cannot be banned; a store admin cannot ban or grant reseller_launch", async () => {
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    expect((await tpost(HOST_A, { action: "ban", id: OWNER_TENANT_ID })).status).toBe(400);
    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    expect([401, 403]).toContain((await tpost(HOST_B, { action: "ban", id: TENANT_B })).status);
    expect([401, 403]).toContain((await tpost(HOST_B, { action: "reseller_launch", id: TENANT_B, allowed: true })).status);
    expect((await getStoreOptions(TENANT_B)).resellerLaunch).toBe(false);
  });
  it("owner toggles reseller_launch for one store only", async () => {
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    expect((await tpost(HOST_A, { action: "reseller_launch", id: TENANT_B, allowed: true })).status).toBe(200);
    expect((await getStoreOptions(TENANT_B)).resellerLaunch).toBe(true);
    expect((await getStoreOptions(OWNER_TENANT_ID)).resellerLaunch).toBe(false);
  });
});

describe("wallet link is locked once set; main account must be proven", () => {
  it("first link works with the real password, second switch is refused", async () => {
    const t: any = { id: TENANT_B, kind: "coadmin" };
    const bad = await linkWalletAccount(t, "raj", "wrong", { id: "x", username: "andrew" });
    expect(bad.ok).toBe(false);
    const good = await linkWalletAccount(t, "raj", "pass-A", { id: "x", username: "andrew" });
    expect(good.ok).toBe(true);
    const again = await linkWalletAccount(t, "raj", "pass-A", { id: "x", username: "andrew" });
    expect(again.ok).toBe(false);
  });
  it("verifyMainAccount refuses admins and wrong passwords", async () => {
    expect((await verifyMainAccount("boss", "pass-boss")).ok).toBe(false);
    expect((await verifyMainAccount("raj", "nope")).ok).toBe(false);
    expect((await verifyMainAccount("raj", "pass-A")).ok).toBe(true);
  });
});

describe("co-admin reseller launch gating", () => {
  it("not eligible from a co-admin store unless the owner allowed it", async () => {
    tables.users.find((u: any) => u.id === "user-rajB")!.role = "reseller";
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    let j: any = await (await applyGet(req("/api/tenant/apply", { host: HOST_B }))).json();
    expect(j.eligible).toBe(false);
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    await tpost(HOST_A, { action: "reseller_launch", id: TENANT_B, allowed: true });
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    j = await (await applyGet(req("/api/tenant/apply", { host: HOST_B }))).json();
    expect(j.eligible).toBe(true);
    expect(j.needsMainAccount).toBe(true);
  });
});

describe("delete store frees the reseller to launch again", () => {
  it("closes the old application and its name", async () => {
    seed("tenant_applications", [{ id: "app1", applicant_user_id: "user-rajA", applicant_tenant_id: OWNER_TENANT_ID, slug: "andrews", status: "approved", brand_name: "Andrews" }]);
    const r = await deleteStore(TENANT_B, "andrews", { id: "o", username: "boss" });
    expect(r.ok).toBe(true);
    expect((tables.tenant_applications.find((a: any) => a.id === "app1") as any).status).toBe("rejected");
  });
});
