import { normalizeStockText } from "@/lib/delivery";

/**
 * Coupon codes (pure logic, no I/O).
 *
 * A coupon has a code, a percentage, and applies to ALL products or to selected products.
 * Customers see only the percentage range on the product card; the code itself is never
 * published. The code is typed by the customer and re-checked on the server at purchase time.
 */

export const COUPONS_KEY = "store_coupons";

export type Coupon = {
  id: string;
  code: string;
  percent: number; // 1..90
  scope: "all" | "products";
  products: string[]; // product names, only used when scope === "products"
  enabled: boolean;
  startsAt: string | null; // ISO
  endsAt: string | null; // ISO
};

/** What the public storefront may see: percentages only, never codes. */
export type PublicCouponView = {
  all: number[];
  products: Record<string, number[]>;
};

const CODE_RE = /^[A-Z0-9_-]{3,24}$/;

export function normalizeCode(input: unknown): string {
  return String(input ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidCode(code: string): boolean {
  return CODE_RE.test(code);
}

const iso = (value: unknown): string | null => {
  if (value === null || value === undefined || value === "") return null;
  const t = Date.parse(String(value));
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/** Cleans stored/posted coupons. Anything malformed is dropped, never repaired by guessing. */
export function sanitizeCoupons(raw: unknown): Coupon[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Coupon[] = [];

  for (const item of raw.slice(0, 500)) {
    const code = normalizeCode((item as any)?.code);
    const percent = Number((item as any)?.percent);
    const scope = (item as any)?.scope === "products" ? "products" : "all";
    const products: string[] = Array.isArray((item as any)?.products)
      ? Array.from(
          new Set(
            ((item as any).products as unknown[])
              .map((n) => String(n ?? "").trim())
              .filter((n) => n.length > 0 && n.length <= 200)
          )
        ).slice(0, 200)
      : [];

    if (!isValidCode(code) || seen.has(code)) continue;
    if (!Number.isInteger(percent) || percent < 1 || percent > 90) continue;
    if (scope === "products" && products.length === 0) continue;

    seen.add(code);
    out.push({
      id: String((item as any)?.id || code),
      code,
      percent,
      scope,
      products: scope === "products" ? products : [],
      enabled: (item as any)?.enabled !== false,
      startsAt: iso((item as any)?.startsAt),
      endsAt: iso((item as any)?.endsAt),
    });
  }
  return out;
}

export function isCouponActive(coupon: Coupon, now: Date = new Date()): boolean {
  if (!coupon.enabled) return false;
  const t = now.getTime();
  if (coupon.startsAt && t < Date.parse(coupon.startsAt)) return false;
  if (coupon.endsAt && t >= Date.parse(coupon.endsAt)) return false;
  return true;
}

export function couponAppliesTo(coupon: Coupon, productName: unknown): boolean {
  if (coupon.scope === "all") return true;
  const wanted = normalizeStockText(productName);
  return coupon.products.some((name) => normalizeStockText(name) === wanted);
}

/** The coupon a customer typed, if it is valid right now for this product. */
export function findCoupon(coupons: Coupon[], codeInput: unknown, productName: unknown, now: Date = new Date()): Coupon | null {
  const code = normalizeCode(codeInput);
  if (!code) return null;
  return coupons.find((c) => c.code === code && isCouponActive(c, now) && couponAppliesTo(c, productName)) ?? null;
}

/** Same rounding as the rest of the store: whole rupees, never below ₹1. */
export function applyPercentOff(price: number, percent: number): number {
  if (!Number.isFinite(price) || price <= 0) return price;
  if (!Number.isFinite(percent) || percent < 1 || percent > 90) return price;
  return Math.max(1, Math.round((price * (100 - percent)) / 100));
}

const uniqueSorted = (list: number[]) => Array.from(new Set(list)).sort((a, b) => a - b);

export function publicCouponView(coupons: Coupon[], now: Date = new Date()): PublicCouponView {
  const view: PublicCouponView = { all: [], products: {} };
  for (const c of coupons) {
    if (!isCouponActive(c, now)) continue;
    if (c.scope === "all") view.all.push(c.percent);
    else for (const name of c.products) (view.products[name] ||= []).push(c.percent);
  }
  view.all = uniqueSorted(view.all);
  for (const name of Object.keys(view.products)) view.products[name] = uniqueSorted(view.products[name]);
  return view;
}

/** Percentages a customer could get on this product (for the small hint on the card). */
export function percentsFor(view: PublicCouponView | null | undefined, productName: unknown): number[] {
  if (!view) return [];
  const wanted = normalizeStockText(productName);
  const list = [...view.all];
  for (const [name, percents] of Object.entries(view.products)) {
    if (normalizeStockText(name) === wanted) list.push(...percents);
  }
  return uniqueSorted(list);
}

/** "10%" / "10% · 20% · 30%" / "10–50%" */
export function formatPercents(percents: number[]): string {
  if (percents.length === 0) return "";
  if (percents.length <= 3) return percents.map((p) => `${p}%`).join(" · ");
  return `${percents[0]}–${percents[percents.length - 1]}%`;
}
