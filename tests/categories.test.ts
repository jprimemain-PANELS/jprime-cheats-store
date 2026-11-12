import { describe, expect, it } from "vitest";
import { normalizeCategory, categoryLabel, categoriesFor } from "@/lib/categories";

describe("product categories", () => {
  it("makes safe slugs", () => {
    expect(normalizeCategory("Gaming Tools!")).toBe("gaming-tools");
    expect(normalizeCategory("<script>alert(1)</script>")).toBe("script-alert-1-script");
    expect(normalizeCategory("   ")).toBeNull();
    expect(normalizeCategory("x".repeat(80))!.length).toBeLessThanOrEqual(24);
  });
  it("labels built-in and custom ones", () => {
    expect(categoryLabel("ios")).toBe("iOS");
    expect(categoryLabel("gaming-tools")).toBe("Gaming Tools");
  });
  it("always shows the three built-ins, adds custom ones that have products", () => {
    expect(categoriesFor(["mobile", "gaming-tools", "gaming-tools"])).toEqual(["mobile", "pc", "ios", "gaming-tools"]);
  });
});
