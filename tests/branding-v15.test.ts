import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, PRESETS, FONTS, buildThemeCss, validateTheme, contrastRatio } from "@/lib/theme";
import { buildVideoKey, imageExtFor, MAX_IMAGE_BYTES } from "@/lib/r2-upload";

describe("v15 branding options", () => {
  it("every preset is readable (text/background and main/background contrast)", () => {
    for (const [name, p] of Object.entries(PRESETS)) {
      expect(contrastRatio(p.foreground, p.background), name).toBeGreaterThanOrEqual(4);
      expect(contrastRatio(p.primary, p.background), name).toBeGreaterThanOrEqual(1.8);
      expect(validateTheme({ preset: name }).ok, name).toBe(true);
    }
    expect(Object.keys(PRESETS).length).toBeGreaterThanOrEqual(17);
    expect(Object.keys(FONTS)).toEqual(expect.arrayContaining(["elegant", "friendly", "bold", "typewriter"]));
  });
  it("old stored themes still load with the new defaults", () => {
    const r = validateTheme({ primary: "#8b5cf6" }, DEFAULT_THEME);
    expect(r.ok && r.theme).toMatchObject({ cardHover: "none", whatsapp: "", instagram: "", youtube: "", floatingChat: false });
  });
  it("social fields: cleaned or refused, never raw HTML", () => {
    const ok = validateTheme({ whatsapp: "+91 98765-43210", instagram: "@my.store", youtube: "https://youtube.com/@mystore", floatingChat: true });
    expect(ok.ok && ok.theme).toMatchObject({ whatsapp: "919876543210", instagram: "my.store", youtube: "https://youtube.com/@mystore", floatingChat: true });
    expect(validateTheme({ whatsapp: "12ab" }).ok).toBe(false);
    expect(validateTheme({ instagram: "<script>" }).ok).toBe(false);
    expect(validateTheme({ youtube: "https://evil.com/x" }).ok).toBe(false);
    expect(validateTheme({ youtube: "javascript:alert(1)" }).ok).toBe(false);
    expect(validateTheme({ cardHover: "spin" }).ok).toBe(false);
    expect(validateTheme({ floatingChat: "yes" }).ok).toBe(false);
  });
  it("card hover css only when motion is on", () => {
    const on = validateTheme({ cardHover: "lift" }); const off = validateTheme({ cardHover: "glow", motion: false });
    expect(on.ok && buildThemeCss(on.theme)).toContain("[data-store-card]:hover{transform:translateY(-5px)}");
    expect(off.ok && buildThemeCss(off.theme)).not.toContain(":hover");
  });
  it("picture uploads: only safe raster types, no SVG, own folder", () => {
    expect(imageExtFor("image/png")).toBe("png"); expect(imageExtFor("image/jpeg")).toBe("jpg");
    expect(imageExtFor("image/svg+xml")).toBeNull(); expect(imageExtFor("text/html")).toBeNull(); expect(imageExtFor("video/mp4")).toBeNull();
    expect(MAX_IMAGE_BYTES).toBe(5 * 1024 * 1024);
    expect(buildVideoKey("../x", "png", "images").startsWith("images/")).toBe(true);
  });
});
