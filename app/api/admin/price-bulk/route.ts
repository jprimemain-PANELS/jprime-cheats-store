import { NextRequest, NextResponse } from "next/server";
import { tdb } from "@/lib/tenant-db";
import { requireTenantAdmin } from "@/lib/auth";
import { loadPriceBook } from "@/lib/price-book";
import { BULK_MODES, computeBulkPrice, parseScope, scopeMatches, type BulkMode, type RoundTo } from "@/lib/price-math";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status, headers: NO_STORE });
}

/**
 * POST /api/admin/price-bulk
 * { action: "preview" | "apply",
 *   scope: { type: "all" | "category" | "products", ... },
 *   target: "retail" | "reseller" | "both",     // which price to change
 *   mode: "percent_off" | "percent_up" | "flat_off" | "flat_up", value: number,
 *   round: 0 | 5 | 10 }
 * Writes the same product_prices rows the Pricing tab already uses.
 */
export async function POST(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const action = String(body?.action || "preview");
    const scope = parseScope(body?.scope);
    const target = String(body?.target || "");
    const mode = String(body?.mode || "") as BulkMode;
    const value = Number(body?.value);
    const round = (Number(body?.round) === 5 || Number(body?.round) === 10 ? Number(body.round) : 0) as RoundTo;

    if (action !== "preview" && action !== "apply") return fail("Unknown action.");
    if (!scope) return fail("Choose which products to change.");
    if (!["retail", "reseller", "both"].includes(target)) return fail("Choose which price to change.");
    if (!BULK_MODES.includes(mode)) return fail("Choose how to change the price.");
    if (!Number.isFinite(value) || value <= 0) return fail("Enter an amount greater than 0.");
    if ((mode === "percent_off" && value >= 100) || (mode === "percent_up" && value > 500)) return fail("That percentage is not allowed.");

    const book = await loadPriceBook(auth.tenant.id);
    if (!book.ok) return fail("Could not load current prices.", 500);

    const changes: {
      product_name: string;
      duration: string;
      old_retail: number;
      new_retail: number;
      old_reseller: number | null;
      new_reseller: number | null;
    }[] = [];
    let skipped = 0;

    for (const row of book.rows) {
      if (!scopeMatches(scope, { name: row.product_name, category: row.category })) continue;

      let newRetail = row.retail;
      let newReseller = row.reseller;
      let touched = false;
      let bad = false;

      if (target === "retail" || target === "both") {
        const next = computeBulkPrice(row.retail, mode, value, round);
        if (next == null) bad = true;
        else {
          newRetail = next;
          touched = true;
        }
      }

      if (target === "reseller" || target === "both") {
        const next = computeBulkPrice(row.reseller ?? row.retail, mode, value, round);
        if (next == null) bad = true;
        else {
          newReseller = next;
          touched = true;
        }
      }

      if (bad || !touched) {
        skipped += 1;
        continue;
      }

      changes.push({
        product_name: row.product_name,
        duration: row.duration,
        old_retail: row.retail,
        new_retail: newRetail,
        old_reseller: row.reseller,
        new_reseller: newReseller,
      });
    }

    if (action === "preview") {
      return NextResponse.json(
        { success: true, total: changes.length, skipped, sample: changes.slice(0, 400) },
        { headers: NO_STORE }
      );
    }

    if (changes.length === 0) return fail("Nothing to change.");
    if (changes.length > 5000) return fail("Too many rows in one go. Choose fewer products.");

    // Always write BOTH columns: a row created with only a reseller price would otherwise
    // get a default retail price of 0.
    const upserts = changes.map((c) => ({
      product_name: c.product_name,
      duration: c.duration,
      price_inr: c.new_retail,
      reseller_price: c.new_reseller,
    }));

    for (let i = 0; i < upserts.length; i += 500) {
      const { error } = await tdb(auth.tenant.id)
        .from("product_prices")
        .upsert(upserts.slice(i, i + 500), { onConflict: "tenant_id,product_name,duration" });
      if (error) {
        console.error("BULK PRICE SAVE ERROR:", error.message);
        return fail(`Saved ${i} of ${upserts.length} rows, then failed. Check the Pricing tab and run it again.`, 500);
      }
    }

    return NextResponse.json({ success: true, changed: changes.length, skipped }, { headers: NO_STORE });
  } catch (error: any) {
    console.error("BULK PRICE ERROR:", error?.message);
    return fail("Bulk price change failed.", 500);
  }
}
