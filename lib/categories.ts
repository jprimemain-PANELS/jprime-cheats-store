/** Product categories: Mobile / PC / iOS are built in; owners and co-admins can add their own (stored as a safe slug). */
export const BUILTIN_CATEGORIES = [
  { id: "mobile", label: "Mobile", blurb: "Premium rooted and non-rooted mobile panels" },
  { id: "pc", label: "PC", blurb: "High-performance, safe desktop PC panels" },
  { id: "ios", label: "iOS", blurb: "A dedicated iOS panel, built for safety" },
] as const;
const BUILTIN_IDS: string[] = BUILTIN_CATEGORIES.map((c) => c.id);

/** "Gaming Tools!" -> "gaming-tools". Returns null when nothing usable is left. */
export function normalizeCategory(input: unknown): string | null {
  const slug = String(input ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24).replace(/-+$/g, "");
  return slug || null;
}

export function categoryLabel(id: string): string {
  const b = BUILTIN_CATEGORIES.find((c) => c.id === id);
  if (b) return b.label;
  return String(id).split("-").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "Other";
}

export const categoryBlurb = (id: string) => BUILTIN_CATEGORIES.find((c) => c.id === id)?.blurb ?? "";

/** Built-ins first (always shown), then any custom category that has at least one product. */
export function categoriesFor(productCategories: string[]): string[] {
  const extra = Array.from(new Set(productCategories.filter((c) => c && !BUILTIN_IDS.includes(c)))).sort();
  return [...BUILTIN_IDS, ...extra];
}
