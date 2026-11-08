/**
 * Pure price helpers (no imports, no I/O) shared by the admin bulk tools, the storefront
 * discount display and the server-side purchase quote.
 */

export type BulkMode = "percent_off" | "percent_up" | "flat_off" | "flat_up";
export type RoundTo = 0 | 1 | 5 | 10;

export type Scope =
  | { type: "all" }
  | { type: "category"; category: string }
  | { type: "products"; products: string[] };

export const BULK_MODES: BulkMode[] = ["percent_off", "percent_up", "flat_off", "flat_up"];

/** Reads a rupee amount from "₹1,200", "1200", 1200. Returns null for anything unusable. */
export function parseRupees(value: unknown): number | null {
  const n = parseFloat(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * New price from a base price. Always a whole rupee, at least ₹1, or null when the input is
 * unusable. round: 0/1 = nearest rupee, 5 = nearest ₹5, 10 = nearest ₹10.
 */
export function computeBulkPrice(base: number, mode: BulkMode, value: number, round: RoundTo = 0): number | null {
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(value) || value < 0) return null;

  let next: number;
  switch (mode) {
    case "percent_off":
      if (value >= 100) return null;
      next = base * (1 - value / 100);
      break;
    case "percent_up":
      next = base * (1 + value / 100);
      break;
    case "flat_off":
      next = base - value;
      break;
    case "flat_up":
      next = base + value;
      break;
    default:
      return null;
  }

  const step = round === 5 || round === 10 ? round : 1;
  const rounded = Math.round(next / step) * step;
  return rounded >= 1 ? rounded : null;
}

/** Validates a scope coming from the browser. */
export function parseScope(raw: any): Scope | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.type === "all") return { type: "all" };
  if (raw.type === "category") {
    const category = String(raw.category || "").trim().toLowerCase();
    return category ? { type: "category", category } : null;
  }
  if (raw.type === "products") {
    const products = Array.isArray(raw.products)
      ? raw.products.map((p: unknown) => String(p ?? "").trim()).filter(Boolean).slice(0, 500)
      : [];
    return products.length ? { type: "products", products } : null;
  }
  return null;
}

export function scopeMatches(scope: Scope, product: { name?: unknown; category?: unknown }): boolean {
  if (scope.type === "all") return true;
  if (scope.type === "category") {
    return String(product.category ?? "").trim().toLowerCase() === scope.category;
  }
  const name = String(product.name ?? "").trim();
  return scope.products.includes(name);
}

/** Customer discount: ₹40 at 10% -> ₹36. Whole rupees, never below ₹1. */
export function applyPercentOff(price: number, percent: number): number {
  if (!Number.isFinite(price) || price <= 0) return price;
  if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) return price;
  return Math.max(1, Math.round((price * (100 - percent)) / 100));
}
