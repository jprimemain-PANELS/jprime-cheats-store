import { beforeEach, describe, expect, it, vi } from "vitest";
import { req } from "./helpers/env";

vi.mock("next/headers", async () => (await import("./helpers/env")).nextHeadersMock());
vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));
vi.mock("@/lib/telegram", () => ({ sendTelegramPurchase: async () => {} }));

import { buildWorld, loginAs, HOST_A, HOST_B, TENANT_B } from "./helpers/world";
import { OWNER_TENANT_ID, clearTenantCache } from "@/lib/tenant";
import { DESIGNS, DESIGN_IDS, cleanDesign, isDesignId } from "@/lib/store-designs";
import { getStoreOptions, publicOptions, saveStoreOptions, clearOptionsCache } from "@/lib/store-options";
import { designCss } from "@/components/designs/design-css";
import { GET as tenantsGet, POST as tenantsPost } from "@/app/api/admin/tenants/route";
import { POST as optPost } from "@/app/api/admin/store-options/route";

const tpost = (host: string, body: any) => tenantsPost(req("/api/admin/tenants", { method: "POST", body, host }));
beforeEach(() => { buildWorld(); clearTenantCache(); clearOptionsCache(); });

describe("store designs", () => {
  it("lists classic + 7 designs with unique ids and names; bad values fall back to classic", () => {
    expect(DESIGNS).toHaveLength(8);
    expect(new Set(DESIGN_IDS).size).toBe(8);
    expect(new Set(DESIGNS.map((d) => d.name)).size).toBe(8);
    expect(cleanDesign("nope")).toBe("classic"); expect(cleanDesign(undefined)).toBe("classic"); expect(cleanDesign("neon")).toBe("neon");
    expect(isDesignId("<script>")).toBe(false);
  });
  it("every new design has its own scoped CSS (nothing leaks to other designs)", () => {
    for (const id of DESIGN_IDS.filter((i) => i !== "classic") as any[]) {
      const css = designCss(id);
      expect(css).toContain(`html[data-design="${id}"]`);
      for (const other of DESIGN_IDS.filter((i) => i !== id && i !== "classic")) expect(css).not.toContain(`[data-design="${other}"]`);
    }
  });
  it("designs follow Branding: saved colours/font win, untouched default theme keeps the design palette; no pixel95", async () => {
    const { DEFAULT_THEME } = await import("@/lib/theme");
    expect(DESIGN_IDS).not.toContain("pixel95");
    expect(designCss("neon", DEFAULT_THEME)).toContain("--store-primary:#22e5ff");
    const custom = designCss("neon", { ...DEFAULT_THEME, primary: "#00aa55", accent: "#ffaa00", background: "#101010", surface: "#181818", foreground: "#eeeeee", font: "serif" });
    expect(custom).toContain("--store-primary:#00aa55");
    expect(custom).toContain("--store-bg:#101010");
    expect(custom).toContain("Georgia");
    const lightCss = designCss("console", { ...DEFAULT_THEME, background: "#f8fafc", surface: "#ffffff", foreground: "#0f172a", primary: "#4f46e5", accent: "#db2777" });
    expect(lightCss).toContain("color-scheme:light");
    expect(designCss("arena", { ...DEFAULT_THEME, cardStyle: "outline" })).not.toContain("[data-store-card]{background");
  });
  it("a store starts as classic and the public options carry the design", async () => {
    expect((await getStoreOptions(TENANT_B)).design).toBe("classic");
    expect(publicOptions(await getStoreOptions(TENANT_B)).design).toBe("classic");
  });
  it("only the owner can set a design (any store, incl. the main one); co-admins and guests cannot", async () => {
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    expect((await tpost(HOST_A, { action: "set_design", id: TENANT_B, design: "arena" })).status).toBe(200);
    expect((await getStoreOptions(TENANT_B)).design).toBe("arena");
    expect((await tpost(HOST_A, { action: "set_design", id: OWNER_TENANT_ID, design: "folio" })).status).toBe(200);
    expect((await getStoreOptions(OWNER_TENANT_ID)).design).toBe("folio");
    expect((await tpost(HOST_A, { action: "set_design", id: TENANT_B, design: "evil" })).status).toBe(400);
    expect((await getStoreOptions(TENANT_B)).design).toBe("arena");
    const j = await (await tenantsGet(req("/api/admin/tenants", { host: HOST_A }))).json();
    expect(j.mainDesign).toBe("folio");
    expect(j.stores.find((s: any) => s.id === TENANT_B).design).toBe("arena");

    loginAs("coadminB", TENANT_B, "andrew", HOST_B);
    expect([401, 403]).toContain((await tpost(HOST_B, { action: "set_design", id: TENANT_B, design: "neon" })).status);
    // the store's own options endpoint ignores a design field
    const o = await optPost(req("/api/admin/store-options", { method: "POST", host: HOST_B, body: { design: "neon", tutorialOn: false } }));
    expect(o.status).toBeLessThan(500);
    expect((await getStoreOptions(TENANT_B)).design).toBe("arena");
    expect((await saveStoreOptions(TENANT_B, { design: "neon" })).ok).toBe(true);
    expect((await getStoreOptions(TENANT_B)).design).toBe("arena");
  });
  it("changing launch settings keeps the chosen design", async () => {
    loginAs("ownerAdmin", OWNER_TENANT_ID, "boss", HOST_A);
    await tpost(HOST_A, { action: "set_design", id: TENANT_B, design: "editorial" });
    await tpost(HOST_A, { action: "reseller_launch", id: TENANT_B, allowed: true, mode: "own" });
    expect(await getStoreOptions(TENANT_B)).toMatchObject({ design: "editorial", resellerLaunch: true, launchMode: "own" });
  });
});
