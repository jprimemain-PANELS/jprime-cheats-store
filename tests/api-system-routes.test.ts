import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, req } from "./helpers/env";

vi.mock("next/headers", async () => (await import("./helpers/env")).nextHeadersMock());
vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));
vi.mock("@/lib/telegram", () => ({ sendTelegramPurchase: async () => {} }));

import { tables, seed } from "./helpers/fake-supabase";
import { buildWorld, loginAs, HOST_A, HOST_B, TENANT_B } from "./helpers/world";
import { OWNER_TENANT_ID } from "@/lib/tenant";
import { GET, POST } from "@/app/api/admin/api-system/route";
import { guardStoreTiers } from "@/lib/api-system";

const asStore = () => loginAs("coadminB", TENANT_B, "andrew", HOST_B);
const asOwner = () => loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
const post = (host: string, body: any) => POST(req("/api/admin/api-system", { method: "POST", body, host }));
const get = (host: string, q = "") => GET(req("/api/admin/api-system" + q, { host }));
const NEW = { action: "create", kind: "other_seller", sellerName: "Fast Keys", endpointUrl: "https://fast.example/api", apiKey: "SUPERSECRETKEY123", masterKey: "", notes: "POST /gen with header x-key" };

beforeEach(() => {
  buildWorld();
  tables.tenant_api_connections = [];
  tables.products_catalog = [];
  seed("products_catalog", [{ tenant_id: OWNER_TENANT_ID, product_id: "pubg-x", name: "PUBG X", data: { id: "pubg-x", name: "PUBG X", status: "ONLINE", videoUrl: "https://v.example/x.mp4", features: ["Aim", "ESP"], prices: [{ duration: "1 day", priceINR: "40", resellerPrice: "28", supplier: "SELLER1", seller1Pid: "P1", seller1Duration: "1" }] } }]);
});

describe("API SYSTEM routes", () => {
  it("anonymous and customers are refused", async () => {
    ctx.cookie = ""; ctx.host = HOST_B;
    expect((await get(HOST_B)).status).toBe(401);
    loginAs("rajB", TENANT_B, "raj", HOST_B);
    expect([401, 403]).toContain((await get(HOST_B)).status);
  });
  it("a store creates a request; keys come back masked; another store never sees it", async () => {
    asStore();
    expect((await post(HOST_B, NEW)).status).toBe(200);
    const j = await (await get(HOST_B)).json();
    expect(j.connections).toHaveLength(1);
    expect(JSON.stringify(j)).not.toContain("SUPERSECRETKEY123");
    expect(j.connections[0].status).toBe("pending");
    // owner sees it, the store cannot decide it
    const id = (tables.tenant_api_connections[0] as any).id;
    expect((await post(HOST_B, { action: "decide", id, decision: "approve", assignedSeller: "SELLER1" })).status).toBe(400);
    expect((tables.tenant_api_connections[0] as any).status).toBe("pending");
    asOwner();
    const o = await (await get(HOST_A)).json();
    expect(o.owner).toBe(true); expect(o.requests).toHaveLength(1); expect(o.sellers.map((s: any) => s.name)).toEqual(["bb team admin", "whitex seller hub"]);
  });
  it("owner approves with a seller -> the store can then sell with its own key; 2nd approval of same seller is refused", async () => {
    asStore(); await post(HOST_B, NEW); await post(HOST_B, { ...NEW, sellerName: "Other One" });
    const [a, b] = tables.tenant_api_connections as any[];
    asOwner();
    expect((await post(HOST_A, { action: "decide", id: a.id, decision: "approve", assignedSeller: "SELLER1" })).status).toBe(200);
    expect((await post(HOST_A, { action: "decide", id: b.id, decision: "approve", assignedSeller: "SELLER1" })).status).toBe(400);
    asStore();
    // approved but no key in the store yet -> still not usable as a supplier in the form
    const p = await (await get(HOST_B, "?for=products")).json();
    expect(p.jprimeAllowed).toBe(false); expect(p.catalog).toEqual([]);
  });
  it("guard: LOCAL ok; seller not approved refused; JPRIME needs access, price floor, locks the id, copies blank video/features", async () => {
    const mk = (o: any = {}) => ({ id: "pubg-x", name: "X", videoUrl: "", features: [""], prices: [{ duration: "1 Day", priceINR: "60", supplier: "JPRIME", jprimeProductId: "pubg-x", jprimeDuration: "1 day", ...o }] });
    expect(await guardStoreTiers(TENANT_B, { id: "a", prices: [{ duration: "1", priceINR: "5", supplier: "LOCAL" }] })).toMatchObject({ ok: true });
    expect(await guardStoreTiers(TENANT_B, { id: "a", prices: [{ duration: "1", priceINR: "5", supplier: "SELLER1" }] })).toMatchObject({ ok: false });
    expect(await guardStoreTiers(TENANT_B, mk())).toMatchObject({ ok: false }); // no wallet linked
    const t = tables.tenants.find((x) => x.id === TENANT_B) as any; t.payer_username = "raj";
    expect(await guardStoreTiers(TENANT_B, mk({ priceINR: "20" }))).toMatchObject({ ok: true }); // the store sets its own price
    const good: any = mk();
    expect(await guardStoreTiers(TENANT_B, good)).toMatchObject({ ok: true });
    expect(good.id).toBe("pubg-x"); expect(good.videoUrl).toBe("https://v.example/x.mp4"); expect(good.features).toEqual(["Aim", "ESP"]);
    const own: any = { ...mk(), videoUrl: "https://mine.example/v.mp4", features: ["Mine"] };
    await guardStoreTiers(TENANT_B, own);
    expect(own.videoUrl).toBe("https://mine.example/v.mp4"); expect(own.features).toEqual(["Mine"]);
    expect(await guardStoreTiers(TENANT_B, mk({ jprimeProductId: "nope" }))).toMatchObject({ ok: false });
    expect(await guardStoreTiers(TENANT_B, { ...mk(), id: "other-id" })).toMatchObject({ ok: false }); // id must stay locked
  });
  it("the picker mirrors the storefront: saved catalogue only (old built-in names never leak); built-ins only when nothing is saved", async () => {
    const { jprimeCatalog, jprimeHidden } = await import("@/lib/api-system");
    const { allProducts } = await import("@/lib/products");
    const list = await jprimeCatalog();
    expect(list.map((p: any) => p.productId)).toEqual(["pubg-x"]);
    // never leaks supplier ids
    expect(JSON.stringify(list)).not.toMatch(/seller1Pid|seller2VariantId|sellerPid/);
    tables.products_catalog = [];
    seed("products_catalog", [
      { tenant_id: OWNER_TENANT_ID, product_id: "pubg-x", name: "PUBG X", data: { id: "pubg-x", name: "PUBG X", prices: [{ duration: "1 day", priceINR: "40", supplier: "LOCAL" }] } },
      { tenant_id: OWNER_TENANT_ID, product_id: "m", name: "In Maint", data: { status: "MAINTENANCE", prices: [{ duration: "1 day", priceINR: "40", supplier: "LOCAL" }] } },
      { tenant_id: OWNER_TENANT_ID, product_id: "z", name: "Zero Price", data: { prices: [{ duration: "1 day", priceINR: "0", supplier: "LOCAL" }] } },
    ]);
    expect((await jprimeCatalog()).map((p: any) => p.productId)).toEqual(["pubg-x"]);
    expect((await jprimeHidden()).map((h) => h.name).sort()).toEqual(["In Maint", "Zero Price"]);
    tables.products_catalog = [];
    expect((await jprimeCatalog()).some((p: any) => p.productId === allProducts[0].id)).toBe(true);
  });
});
