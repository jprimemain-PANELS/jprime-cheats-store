import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/headers", async () => (await import("./helpers/env")).nextHeadersMock());
vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));
vi.mock("@/lib/telegram", () => ({ sendTelegramPurchase: async () => {} }));
import { tables } from "./helpers/fake-supabase";
import { buildWorld, TENANT_B } from "./helpers/world";
import { clearTenantCache } from "@/lib/tenant";
import { upgradeToReseller } from "@/lib/upgrade-reseller";
import { saveStoreOptions } from "@/lib/store-options";

const raj = () => ({ id: "user-rajB", username: "raj", role: "user" });
const bal = () => Number((tables.wallets.find((w) => w.username === "raj" && w.tenant_id === TENANT_B) as any).balance);
const role = () => (tables.users.find((u: any) => u.id === "user-rajB") as any).role;
beforeEach(() => { buildWorld(); clearTenantCache(); });

describe("customer upgrades to reseller", () => {
  it("is refused while the store switch is OFF", async () => {
    expect(await upgradeToReseller(TENANT_B, raj())).toMatchObject({ ok: false, status: 403 });
    expect(bal()).toBe(50); expect(role()).toBe("user");
  });
  it("charges the store's price once, promotes, ledger written; second try refused", async () => {
    await saveStoreOptions(TENANT_B, { upgradeOn: true, upgradePrice: 30 } as any);
    expect(await upgradeToReseller(TENANT_B, raj())).toMatchObject({ ok: true, price: 30 });
    expect(bal()).toBe(20); expect(role()).toBe("reseller");
    expect(await upgradeToReseller(TENANT_B, { ...raj(), role: "reseller" })).toMatchObject({ ok: false, status: 409 });
    expect(bal()).toBe(20);
  });
  it("not enough balance -> nothing changes", async () => {
    await saveStoreOptions(TENANT_B, { upgradeOn: true, upgradePrice: 500 } as any);
    expect(await upgradeToReseller(TENANT_B, raj())).toMatchObject({ ok: false, status: 402 });
    expect(bal()).toBe(50); expect(role()).toBe("user");
  });
  it("money is returned if the role changed meanwhile (e.g. admin already promoted them)", async () => {
    await saveStoreOptions(TENANT_B, { upgradeOn: true, upgradePrice: 30 } as any);
    (tables.users.find((u: any) => u.id === "user-rajB") as any).role = "vip_reseller";
    expect(await upgradeToReseller(TENANT_B, raj())).toMatchObject({ ok: false });
    expect(bal()).toBe(50); expect(role()).toBe("vip_reseller");
  });
  it("only affects the customer's own store wallet (owner store raj untouched)", async () => {
    await saveStoreOptions(TENANT_B, { upgradeOn: true, upgradePrice: 30 } as any);
    await upgradeToReseller(TENANT_B, raj());
    expect(Number((tables.wallets.find((w) => w.username === "raj" && w.tenant_id !== TENANT_B) as any).balance)).toBe(1000);
  });
});
