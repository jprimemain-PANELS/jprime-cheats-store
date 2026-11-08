import { applyPercentOff, parseScope, scopeMatches, type Scope } from "@/lib/price-math";

/**
 * Store discount rules (pure logic, shared by the admin screen, the storefront and the
 * server-side purchase quote). Rules are stored as JSON in app_settings under STORE_DISCOUNTS_KEY.
 *
 * A discount lowers the RETAIL price that normal customers pay. Resellers keep their own
 * reseller / VIP prices and are never discounted a second time.
 */

export const STORE_DISCOUNTS_KEY = "store_discounts";

export interface DiscountRule {
  id: string;
  label: string;
  percent: number; // 1..90
  scope: Scope;
  startsAt: string | null; // ISO, null = already started
  endsAt: string | null; // ISO, null = no end
  enabled: boolean;
}

function cleanDate(value: unknown): string | null {
  if (!value) return null;
  const t = new Date(String(value)).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Reads rules from untrusted JSON. Invalid rules are dropped, never repaired by guessing. */
export function sanitizeRules(input: unknown): DiscountRule[] {
  const list = Array.isArray(input) ? input : [];
  const rules: DiscountRule[] = [];

  for (const raw of list.slice(0, 100)) {
    const id = String(raw?.id ?? "").trim().slice(0, 64);
    const percent = Number(raw?.percent);
    const scope = parseScope(raw?.scope);
    if (!id || !scope || !Number.isFinite(percent) || percent < 1 || percent > 90) continue;

    rules.push({
      id,
      label: String(raw?.label ?? "").trim().slice(0, 60) || "Sale",
      percent: Math.round(percent * 100) / 100,
      scope,
      startsAt: cleanDate(raw?.startsAt),
      endsAt: cleanDate(raw?.endsAt),
      enabled: raw?.enabled !== false,
    });
  }

  return rules;
}

export function isRuleActive(rule: DiscountRule, now: Date = new Date()): boolean {
  if (!rule.enabled) return false;
  const t = now.getTime();
  if (rule.startsAt && new Date(rule.startsAt).getTime() > t) return false;
  if (rule.endsAt && new Date(rule.endsAt).getTime() <= t) return false;
  return true;
}

/** The single best (highest percent) active rule for a product, or null. Rules never stack. */
export function bestDiscountFor(
  rules: DiscountRule[],
  product: { name?: unknown; category?: unknown },
  now: Date = new Date()
): DiscountRule | null {
  let best: DiscountRule | null = null;
  for (const rule of rules) {
    if (!isRuleActive(rule, now) || !scopeMatches(rule.scope, product)) continue;
    if (!best || rule.percent > best.percent) best = rule;
  }
  return best;
}

export interface PriceView {
  final: number; // what the customer pays
  original: number | null; // struck-through price, only when discounted
  percent: number | null;
  saving: number | null;
  label: string | null;
  endsAt: string | null;
}

/** Everything the storefront needs to draw one price. */
export function priceView(
  retail: number,
  rules: DiscountRule[],
  product: { name?: unknown; category?: unknown },
  now: Date = new Date()
): PriceView {
  const rule = bestDiscountFor(rules, product, now);
  if (!rule) return { final: retail, original: null, percent: null, saving: null, label: null, endsAt: null };

  const final = applyPercentOff(retail, rule.percent);
  if (final >= retail) return { final: retail, original: null, percent: null, saving: null, label: null, endsAt: null };

  return {
    final,
    original: retail,
    percent: rule.percent,
    saving: retail - final,
    label: rule.label,
    endsAt: rule.endsAt,
  };
}
