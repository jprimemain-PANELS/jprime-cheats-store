import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, rateLimit } from "@/lib/auth";
import { MAX_ACTIVITY_EVENTS, maskUsername, type ActivityEvent } from "@/lib/recent-activity";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/* ------------------------------------------------------------------ */
/*  WHAT COUNTS AS A REAL, SUCCESSFUL EVENT  (all assumptions here)    */
/* ------------------------------------------------------------------ */
/**
 * DEPOSITS  <- wallet_transactions
 *   A ledger row is written only AFTER the wallet is credited (the deposit
 *   RPC credits + logs in one transaction), so a row existing == credited.
 *   - type must be one of WALLET_DEPOSIT_TYPES. Verified UPI wallet deposits
 *     (verify-wallet-payment) are recorded as type "deposit" with description
 *     "Wallet Deposit Verification Successful".
 *   - Admin-added funds are recorded as type "credit" with description
 *     "Admin added funds". "credit" is NOT in WALLET_DEPOSIT_TYPES, so admin
 *     credits are never treated as customer deposits. As a second guard, any
 *     row whose description starts with "Admin" is also excluded.
 *   - "purchase", "debit" and "refund" rows are never deposits.
 *
 * PURCHASES <- purchase_history
 *   Rows are inserted only after the key was actually delivered
 *   (verify-payment and pay-via-wallet both insert after delivery succeeds).
 *   Wallet "purchase" ledger rows are deliberately NOT read, so a wallet
 *   purchase (which exists in both tables) can never show up twice.
 */
const WALLET_DEPOSIT_TYPES = ["deposit"];
const ADMIN_DESCRIPTION_PREFIX = "Admin";

// Over-fetch a little so rows dropped by validation never leave us under 10.
const FETCH_PER_SOURCE = 25;

// All users see the same masked feed, so one short server-side cache protects the DB.
const CACHE_TTL_MS = 10_000;

type FeedResult = { events: ActivityEvent[]; partial: boolean };

let cache: { at: number; value: FeedResult } | null = null;
let inflight: Promise<FeedResult> | null = null;

function eventKey(parts: Array<string | number>) {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function validTime(value: unknown): string | null {
  const iso = String(value ?? "");
  return Number.isFinite(Date.parse(iso)) ? iso : null;
}

async function loadDeposits(): Promise<ActivityEvent[]> {
  // description is only used inside the filter; it is never selected or returned.
  const { data, error } = await supabaseAdmin
    .from("wallet_transactions")
    .select("username, amount, created_at")
    .in("type", WALLET_DEPOSIT_TYPES)
    .or(`description.is.null,description.not.ilike.${ADMIN_DESCRIPTION_PREFIX}%`)
    .order("created_at", { ascending: false })
    .limit(FETCH_PER_SOURCE);

  if (error) throw new Error(`wallet_transactions: ${error.message}`);

  const events: ActivityEvent[] = [];
  for (const row of data ?? []) {
    const user = maskUsername(row.username);
    const amount = Number(row.amount);
    const at = validTime(row.created_at);
    if (!user || !at || !Number.isFinite(amount) || amount <= 0) continue;

    events.push({
      key: eventKey(["deposit", String(row.username), at, amount]),
      kind: "deposit",
      user,
      amount: Math.round(amount * 100) / 100,
      at,
    });
  }
  return events;
}

async function loadPurchases(): Promise<ActivityEvent[]> {
  // key_code / price_paid are intentionally NOT selected.
  const { data, error } = await supabaseAdmin
    .from("purchase_history")
    .select("username, product_name, duration, created_at")
    .order("created_at", { ascending: false })
    .limit(FETCH_PER_SOURCE);

  if (error) throw new Error(`purchase_history: ${error.message}`);

  const events: ActivityEvent[] = [];
  for (const row of data ?? []) {
    const user = maskUsername(row.username);
    const product = cleanText(row.product_name, 80);
    const duration = cleanText(row.duration, 40);
    const at = validTime(row.created_at);
    if (!user || !product || !at) continue;

    events.push({
      key: eventKey(["purchase", String(row.username), at, product, duration]),
      kind: "purchase",
      user,
      product,
      ...(duration ? { duration } : {}),
      at,
    });
  }
  return events;
}

async function buildFeed(): Promise<FeedResult> {
  const [deposits, purchases] = await Promise.allSettled([loadDeposits(), loadPurchases()]);

  if (deposits.status === "rejected") console.error("RECENT ACTIVITY ERROR:", deposits.reason?.message);
  if (purchases.status === "rejected") console.error("RECENT ACTIVITY ERROR:", purchases.reason?.message);

  if (deposits.status === "rejected" && purchases.status === "rejected") {
    throw new Error("Both activity sources failed.");
  }

  const merged = [
    ...(deposits.status === "fulfilled" ? deposits.value : []),
    ...(purchases.status === "fulfilled" ? purchases.value : []),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  // Guarantee unique keys even if two identical rows share a timestamp.
  const seen = new Map<string, number>();
  const events = merged.slice(0, MAX_ACTIVITY_EVENTS).map((event) => {
    const n = seen.get(event.key) ?? 0;
    seen.set(event.key, n + 1);
    return n === 0 ? event : { ...event, key: `${event.key}-${n}` };
  });

  return { events, partial: deposits.status === "rejected" || purchases.status === "rejected" };
}

async function getFeed(): Promise<FeedResult> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  if (inflight) return inflight;

  inflight = buildFeed()
    .then((value) => {
      cache = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/**
 * GET /api/recent-activity
 * Logged-in users only. Returns the latest 10 successful wallet top-ups and
 * purchases with masked usernames. No UTRs, e-mails, phones, balances, keys,
 * payment ids or purchase prices are ever selected or returned.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  if (!rateLimit(`recent-activity:${auth.user.username}`, 20, 60_000)) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait a moment." },
      { status: 429, headers: NO_STORE }
    );
  }

  try {
    const feed = await getFeed();
    return NextResponse.json(
      { success: true, events: feed.events, partial: feed.partial, generatedAt: new Date().toISOString() },
      { headers: NO_STORE }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Could not load recent activity." },
      { status: 500, headers: NO_STORE }
    );
  }
}