import { tdb } from "@/lib/tenant-db";
import {
  buildStockCountMap,
  normalizeStockText,
  stockCountKey,
  stockRowMatches,
} from "@/lib/delivery";

/**
 * Server-side local stock access. EVERY count and every reservation goes through here so the
 * admin matrix, the customer counter and the real purchase all use the same matching rule
 * (unused keys only; letter case, extra spaces and styled Unicode letters such as
 * "𝗣𝗛𝗔𝗡𝗧𝗢𝗠" vs "PHANTOM" are treated as the same name) and none of them is limited by the
 * database's default 1000-row response cap.
 *
 * The comparison is done in code, not with SQL text filters, because the database cannot
 * normalise styled Unicode letters.
 *
 * Nothing here deletes, merges, recreates or rewrites stored keys. The only write is the
 * reservation, which flips is_used on ONE key at the moment of a real purchase.
 */

const PAGE_SIZE = 1000;
const MAX_PAGES = 50; // hard safety stop (50,000 rows)

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** All unused rows (oldest id first), read page by page. */
async function fetchUnusedPages(tenantId: string, columns: string): Promise<Result<any[]>> {
  const rows: any[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;

    const { data, error } = await tdb(tenantId)
      .from("stock_keys")
      .select(columns)
      .eq("is_used", false)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("STOCK LOOKUP ERROR:", error.message);
      return { ok: false, error: error.message };
    }

    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return { ok: true, data: rows };
}

/**
 * Every unused key (all columns). Used by the admin dashboard so the Stock Keys list and the
 * Stock Matrix are built from the SAME complete data instead of a truncated first page.
 */
export async function fetchAllUnusedStock(tenantId: string): Promise<Result<any[]>> {
  return fetchUnusedPages(tenantId, "*");
}

/* Customer counters ask for the same numbers many times per page view (one per product card),
   so a very short in-memory snapshot is shared. Reservations and admin counts never use it. */
const SNAPSHOT_MS = 10_000;
const snapshots = new Map<string, { at: number; counts: Map<string, number> }>(); // per store

export async function countLocalStock(
  tenantId: string,
  productName: string,
  duration: string,
  options: { fresh?: boolean } = {}
): Promise<Result<number>> {
  if (!normalizeStockText(productName) || !normalizeStockText(duration)) {
    return { ok: true, data: 0 };
  }

  const now = Date.now();

  let snap = snapshots.get(tenantId);
  if (options.fresh || !snap || now - snap.at > SNAPSHOT_MS) {
    const rows = await fetchUnusedPages(tenantId, "id, product_name, duration");
    if (!rows.ok) return rows;
    snap = { at: now, counts: buildStockCountMap(rows.data) };
    snapshots.set(tenantId, snap);
  }

  return { ok: true, data: snap.counts.get(stockCountKey(productName, duration)) ?? 0 };
}

export type ClaimResult =
  | { status: "ok"; key: string }
  | { status: "empty" }
  | { status: "error"; message: string };

/**
 * Reserves the oldest matching unused key. If another buyer grabs a candidate first
 * (compare-and-set on is_used=false fails) the next candidate is tried, so two simultaneous
 * purchases never fail just because they raced for the same row.
 */
export async function claimLocalStockKey(tenantId: string, productName: string, duration: string): Promise<ClaimResult> {
  const rows = await fetchUnusedPages(tenantId, "id, product_name, duration, key_code");
  if (!rows.ok) return { status: "error", message: rows.error };

  const candidates = rows.data.filter(
    (row) => stockRowMatches(row, productName, duration) && String(row.key_code ?? "").trim() !== ""
  );

  for (const candidate of candidates.slice(0, 25)) {
    const { data, error } = await tdb(tenantId)
      .from("stock_keys")
      .update({ is_used: true })
      .eq("id", candidate.id)
      .eq("is_used", false)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("LOCAL STOCK RESERVE ERROR:", error.message);
      return { status: "error", message: error.message };
    }

    if (data) {
      snapshots.delete(tenantId); // counts changed
      return { status: "ok", key: String(candidate.key_code) };
    }
  }

  return { status: "empty" };
}
