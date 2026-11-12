import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, req } from "./helpers/env";
vi.mock("next/headers", async () => (await import("./helpers/env")).nextHeadersMock());
vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));
vi.mock("@/lib/telegram", () => ({ sendTelegramPurchase: async () => {} }));
import { tables, seed } from "./helpers/fake-supabase";
import { buildWorld, HOST_B, TENANT_B } from "./helpers/world";
import { OWNER_TENANT_ID, clearTenantCache } from "@/lib/tenant";
import { GET as catalogGet } from "@/app/api/catalog/route";

const tier = (d: string, jd: string) => ({ duration: d, priceINR: "60", supplier: "JPRIME", jprimeProductId: "pubg-x", jprimeDuration: jd });
beforeEach(() => {
  buildWorld(); clearTenantCache(); ctx.host = HOST_B;
  tables.products_catalog = [];
  seed("products_catalog", [
    { tenant_id: OWNER_TENANT_ID, product_id: "pubg-x", name: "PUBG X", data: { name: "PUBG X", prices: [{ duration: "1 day", priceINR: "40", supplier: "LOCAL" }] } },
    { tenant_id: TENANT_B, product_id: "c1", name: "Copy", data: { name: "Copy", prices: [tier("1 Day", "1 day"), tier("9 Days", "9 days")] } },
    { tenant_id: TENANT_B, product_id: "c2", name: "Own thing", data: { name: "Own thing", prices: [{ duration: "1 Day", priceINR: "10", supplier: "LOCAL" }] } },
  ]);
});
const names = async () => ((await (await catalogGet()).json()).products as any[]).map((p) => `${p.name}:${p.prices.map((t: any) => t.duration).join("/")}`).sort();

describe("co-admin catalogue follows the owner's JPRIME products", () => {
  it("hides only the durations the owner no longer sells; own products stay", async () => {
    expect(await names()).toEqual(["Copy:1 Day", "Own thing:1 Day"]);
  });
  it("owner deletes the product -> the co-admin copy disappears, own products stay", async () => {
    tables.products_catalog = tables.products_catalog.filter((r: any) => r.product_id !== "pubg-x");
    expect(await names()).toEqual(["Own thing:1 Day"]);
  });
  it("owner maintenance keeps the copy visible", async () => {
    (tables.products_catalog[0] as any).data.status = "MAINTENANCE";
    expect(await names()).toEqual(["Copy:1 Day", "Own thing:1 Day"]);
  });
});
