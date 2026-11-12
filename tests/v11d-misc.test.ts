import { beforeEach, describe, expect, it, vi } from "vitest";
import { req } from "./helpers/env";
vi.mock("next/headers", async () => (await import("./helpers/env")).nextHeadersMock());
vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));
vi.mock("@/lib/telegram", () => ({ sendTelegramPurchase: async () => {} }));
import { tables, seed } from "./helpers/fake-supabase";
import { buildWorld, loginAs, HOST_B, TENANT_B } from "./helpers/world";
import { clearTenantCache, OWNER_TENANT_ID } from "@/lib/tenant";
import { welcomeState } from "@/lib/store-options";
import { buildUserLedger } from "@/lib/user-ledger";
import { POST as createUpiOrder } from "@/app/api/create-upi-order/route";

beforeEach(() => { buildWorld(); clearTenantCache(); });

describe("welcome steps: 5 days then never again (server clock)", () => {
  it("shows during the first 5 days, hidden after, never for the owner", async () => {
    const t0 = Date.parse("2026-11-12T00:00:00Z");
    expect((await welcomeState(TENANT_B, t0)).show).toBe(true);
    expect((await welcomeState(TENANT_B, t0 + 4 * 864e5)).show).toBe(true);
    expect((await welcomeState(TENANT_B, t0 + 5 * 864e5 + 1000)).show).toBe(false);
    expect((await welcomeState(TENANT_B, t0 + 30 * 864e5)).show).toBe(false);
    expect((await welcomeState(OWNER_TENANT_ID, t0)).show).toBe(false);
  });
});

describe("direct UPI product payment is off", () => {
  it("returns 410 and creates nothing", async () => {
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    const before = (tables.payment_orders ?? []).length;
    const r = await createUpiOrder(req("/api/create-upi-order", { method: "POST", body: { product_name: "x", duration: "1 Day" }, host: HOST_B }));
    expect(r.status).toBe(410);
    expect((tables.payment_orders ?? []).length).toBe(before);
  });
});

describe("ledger: uncredited top-ups are visible", () => {
  it("lists pending/failed deposits with order id, not counted as money", () => {
    const now = Date.parse("2026-11-12T10:00:00Z");
    const { entries, summary } = buildUserLedger([], [], { now, deposits: [
      { id: 1, status: "pending", amount: "50.00", gateway_order_id: "ORD1", gateway: "paytm", created_at: "2026-11-12T09:00:00Z" },
      { id: 2, status: "success", amount: "20", gateway_order_id: "ORD2", created_at: "2026-11-12T08:00:00Z" },
    ] });
    const p = entries.filter((e) => e.kind === "topup_pending");
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ orderId: "ORD1", gateway: "paytm" });
    expect(summary.pendingTopups).toBe(1);
    expect(summary.walletTopups).toBe(0);
  });
});
