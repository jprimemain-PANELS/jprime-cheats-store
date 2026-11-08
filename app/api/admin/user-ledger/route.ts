import { NextRequest, NextResponse } from "next/server";
import { tdb } from "@/lib/tenant-db";
import { requireTenantAdmin } from "@/lib/auth";
import { buildUserLedger } from "@/lib/user-ledger";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const LIMIT = 3000;

/**
 * GET /api/admin/user-ledger?username=<exact username>
 * Admin only. Read-only: merges wallet_transactions and purchase_history into one timeline.
 */
export async function GET(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;

  const username = String(request.nextUrl.searchParams.get("username") || "");
  if (!username || username.length > 100) {
    return NextResponse.json({ success: false, error: "Missing username." }, { status: 400, headers: NO_STORE });
  }

  const db = tdb(auth.tenant.id);
  const [tx, purchases, deposits, orders] = await Promise.all([
    db
      .from("wallet_transactions")
      .select("*")
      .eq("username", username)
      .limit(LIMIT),
    db
      .from("purchase_history")
      .select("*")
      .eq("username", username)
      .order("id", { ascending: false })
      .limit(LIMIT),
    // Only used to recover missing top-up times. Any error is ignored on purpose.
    db.from("deposit_history").select("*").eq("username", username).limit(LIMIT),
    // Only the UPI orders that did NOT end with a delivered key are shown.
    db
      .from("payment_orders")
      .select("*")
      .eq("username", username)
      .in("status", ["delivery_failed", "processing", "amount_mismatch", "duplicate_utr"])
      .limit(LIMIT),
  ]);

  if (tx.error || purchases.error) {
    console.error("ADMIN USER LEDGER ERROR:", tx.error?.message || purchases.error?.message);
    return NextResponse.json({ success: false, error: "Could not load the ledger." }, { status: 500, headers: NO_STORE });
  }

  const { entries, summary } = buildUserLedger(tx.data || [], purchases.data || [], {
    deposits: deposits.error ? [] : deposits.data || [],
    orders: orders.error ? [] : orders.data || [],
  });

  return NextResponse.json(
    {
      success: true,
      username,
      entries,
      summary,
      truncated: (tx.data || []).length >= LIMIT || (purchases.data || []).length >= LIMIT,
    },
    { headers: NO_STORE }
  );
}
