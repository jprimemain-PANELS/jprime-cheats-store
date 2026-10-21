/**
 * Shared types + pure helpers for the Live Recent Activity ticker.
 * Used by app/api/recent-activity/route.ts (server) and
 * components/recent-activity.tsx (client). No secrets, no I/O.
 */

export type ActivityKind = "deposit" | "purchase";

/** The ONLY shape that ever leaves the server. Nothing private is in here. */
export interface ActivityEvent {
  /** Opaque, stable id (hash). Safe to use as a React key. */
  key: string;
  kind: ActivityKind;
  /** Already masked on the server, e.g. "An***". */
  user: string;
  /** Deposits only: the amount credited to the wallet, in INR. */
  amount?: number;
  /** Purchases only. */
  product?: string;
  duration?: string;
  /** ISO timestamp of the underlying row's created_at. */
  at: string;
}

export const MAX_ACTIVITY_EVENTS = 10;
export const ACTIVITY_POLL_MS = 20_000;

/**
 * "Anil" -> "An***", "Raj" -> "R***", "a@b.com" -> "a***".
 * Short names, e-mail-like names and all-digit names (phone-like) reveal only 1 char.
 */
export function maskUsername(raw: unknown): string | null {
  const chars = Array.from(String(raw ?? "").trim());
  if (chars.length === 0) return null;

  const allDigits = chars.every((c) => c >= "0" && c <= "9");
  const looksLikeEmail = chars.includes("@");
  const visible = chars.length <= 3 || allDigits || looksLikeEmail ? 1 : 2;

  return chars.slice(0, visible).join("") + "***";
}

/** "just now", "1 minute ago", "10 minutes ago", "3 hours ago", "2 days ago", ... */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";

  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now"; // also covers small clock skew (negative values)

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;

  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/** 100 -> "₹100", 99.5 -> "₹99.50", 1500 -> "₹1,500" */
export function formatInr(amount: number): string {
  const whole = Number.isInteger(amount);
  return (
    "₹" +
    amount.toLocaleString("en-IN", {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

/** Plain-text sentence for an event (used for tooltips / screen readers). */
export function describeActivity(event: ActivityEvent): string {
  if (event.kind === "deposit") {
    return `${event.user} added ${formatInr(event.amount ?? 0)} to their wallet`;
  }
  return `${event.user} purchased ${event.product ?? "a product"}${
    event.duration ? ` for ${event.duration}` : ""
  }`;
}

/** Defensive check for data coming back from the API. */
export function isActivityEvent(value: unknown): value is ActivityEvent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.key !== "string" || typeof v.user !== "string" || typeof v.at !== "string") return false;
  if (v.kind === "deposit") return typeof v.amount === "number" && Number.isFinite(v.amount);
  if (v.kind === "purchase") return typeof v.product === "string";
  return false;
}