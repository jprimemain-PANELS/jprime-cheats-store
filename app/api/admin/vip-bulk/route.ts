import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth";
import { loadPriceBook, type PriceRow } from "@/lib/price-book";
import { BULK_MODES, computeBulkPrice, parseScope, scopeMatches, type BulkMode, type RoundTo, type Scope } from "@/lib/price-math";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_RESELLERS = 300;
const MAX_ROWS = 30000;

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status, headers: NO_STORE });
}

const keyOf = (name: string, duration: string) => `${name}::${duration}`;

/** Resellers named by the admin ("ALL" = every reseller). Anyone who is not a reseller is rejected. */
async function resolveResellers(input: unknown): Promise<{ ok: true; names: string[] } | { ok: false; error: string }> {
  if (input === "ALL") {
    const names: string[] = [];
    for (let page = 0; page < 20; page += 1) {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("username")
        .eq("role", "reseller")
        .order("username", { ascending: true })
        .range(page * 1000, page * 1000 + 999);
      if (error) return { ok: false, error: "Could not load resellers." };
      names.push(...(data || []).map((u: any) => String(u.username)));
      if ((data || []).length < 1000) break;
    }
    return { ok: true, names };
  }

  const wanted = Array.isArray(input) ? Array.from(new Set(input.map((n) => String(n ?? "").trim()).filter(Boolean))) : [];
  if (wanted.length === 0) return { ok: false, error: "Choose at least one reseller." };

  const found = new Set<string>();
  for (let i = 0; i < wanted.length; i += 100) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("username, role")
      .in("username", wanted.slice(i, i + 100));
    if (error) return { ok: false, error: "Could not verify resellers." };
    for (const u of data || []) if ((u as any).role === "reseller") found.add(String((u as any).username));
  }

  const missing = wanted.filter((n) => !found.has(n));
  if (missing.length) return { ok: false, error: `Not a reseller: ${missing.slice(0, 5).join(", ")}` };
  return { ok: true, names: wanted };
}

/** username -> ("product::duration" -> current VIP price) */
async function loadOverrides(usernames: string[]): Promise<{ ok: true; map: Map<string, Map<string, number>> } | { ok: false }> {
  const map = new Map<string, Map<string, number>>();
  for (const name of usernames) map.set(name, new Map());

  for (let i = 0; i < usernames.length; i += 40) {
    const chunk = usernames.slice(i, i + 40);
    for (let page = 0; page < 40; page += 1) {
      const { data, error } = await supabaseAdmin
        .from("reseller_price_overrides")
        .select("username, product_name, duration, reseller_price")
        .in("username", chunk)
        .order("username", { ascending: true })
        .range(page * 1000, page * 1000 + 999);
      if (error) return { ok: false };
      for (const r of (data || []) as any[]) {
        map.get(String(r.username))?.set(keyOf(String(r.product_name).trim(), String(r.duration).trim()), Number(r.reseller_price));
      }
      if ((data || []).length < 1000) break;
    }
  }
  return { ok: true, map };
}

function rowsInScope(book: PriceRow[], scope: Scope) {
  return book.filter((r) => scopeMatches(scope, { name: r.product_name, category: r.category }));
}

/**
 * POST /api/admin/vip-bulk
 *  { action: "preview" | "apply" | "reset" | "copy",
 *    usernames: string[] | "ALL",
 *    scope: { type: "all" | "category" | "products", ... },
 *    -- preview / apply --
 *    mode: "percent_off" | "percent_up" | "flat_off" | "flat_up", value, round: 0|5|10,
 *    base: "default" | "retail" | "current",
 *    -- copy --
 *    fromUsername }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const action = String(body?.action || "");
    const scope = parseScope(body?.scope);
    if (!["preview", "apply", "reset", "copy"].includes(action)) return fail("Unknown action.");
    if (!scope) return fail("Choose which products to change.");

    const resellers = await resolveResellers(body?.usernames);
    if (!resellers.ok) return fail(resellers.error);
    const usernames = resellers.names;
    if (usernames.length === 0) return fail("There are no resellers.");
    if (usernames.length > MAX_RESELLERS) return fail(`Choose at most ${MAX_RESELLERS} resellers at a time.`);

    const book = await loadPriceBook();
    if (!book.ok) return fail("Could not load current prices.", 500);
    const scoped = rowsInScope(book.rows, scope);

    /* ---------------- reset: remove custom prices ---------------- */
    if (action === "reset") {
      const productNames = Array.from(new Set(scoped.map((r) => r.product_name)));
      if (productNames.length === 0) return fail("No products match.");

      for (let i = 0; i < usernames.length; i += 50) {
        const userChunk = usernames.slice(i, i + 50);
        if (scope.type === "all") {
          const { error } = await supabaseAdmin.from("reseller_price_overrides").delete().in("username", userChunk);
          if (error) return fail("Could not reset prices.", 500);
        } else {
          for (let j = 0; j < productNames.length; j += 40) {
            const { error } = await supabaseAdmin
              .from("reseller_price_overrides")
              .delete()
              .in("username", userChunk)
              .in("product_name", productNames.slice(j, j + 40));
            if (error) return fail("Could not reset prices.", 500);
          }
        }
      }
      return NextResponse.json({ success: true, resellers: usernames.length }, { headers: NO_STORE });
    }

    /* ---------------- copy: same prices from another reseller ---------------- */
    if (action === "copy") {
      const from = await resolveResellers([String(body?.fromUsername || "")]);
      if (!from.ok) return fail(from.error);
      const source = await loadOverrides(from.names);
      if (!source.ok) return fail("Could not read the source prices.", 500);

      const inScope = new Set(scoped.map((r) => keyOf(r.product_name, r.duration)));
      const rows: any[] = [];
      for (const [k, price] of source.map.get(from.names[0]) || []) {
        if (!inScope.has(k)) continue;
        const [product_name, duration] = k.split("::");
        for (const username of usernames) {
          if (username === from.names[0]) continue;
          rows.push({ username, product_name, duration, reseller_price: Math.round(price), updated_at: new Date().toISOString() });
        }
      }
      if (rows.length === 0) return fail("That reseller has no custom prices to copy.");
      if (rows.length > MAX_ROWS) return fail("Too many rows in one go.");

      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabaseAdmin
          .from("reseller_price_overrides")
          .upsert(rows.slice(i, i + 500), { onConflict: "username,product_name,duration" });
        if (error) return fail(`Copied ${i} of ${rows.length} rows, then failed.`, 500);
      }
      return NextResponse.json({ success: true, rows: rows.length, resellers: usernames.length }, { headers: NO_STORE });
    }

    /* ---------------- preview / apply a % or ₹ change ---------------- */
    const mode = String(body?.mode || "") as BulkMode;
    const value = Number(body?.value);
    const round = (Number(body?.round) === 5 || Number(body?.round) === 10 ? Number(body.round) : 0) as RoundTo;
    const baseKind = ["default", "retail", "current"].includes(String(body?.base)) ? String(body.base) : "default";

    if (!BULK_MODES.includes(mode)) return fail("Choose how to change the price.");
    if (!Number.isFinite(value) || value <= 0) return fail("Enter an amount greater than 0.");
    if ((mode === "percent_off" && value >= 100) || (mode === "percent_up" && value > 500)) return fail("That percentage is not allowed.");
    if (scoped.length === 0) return fail("No products match.");
    if (scoped.length * usernames.length > MAX_ROWS) return fail("Too many rows in one go. Choose fewer resellers or products.");

    const overrides = await loadOverrides(usernames);
    if (!overrides.ok) return fail("Could not read current VIP prices.", 500);

    const build = (username: string) => {
      const current = overrides.map.get(username) || new Map<string, number>();
      const out: { product_name: string; duration: string; base: number; old: number | null; price: number }[] = [];
      let skipped = 0;
      for (const row of scoped) {
        const k = keyOf(row.product_name, row.duration);
        const old = current.get(k) ?? null;
        const base = baseKind === "retail" ? row.retail : baseKind === "current" ? old ?? row.reseller ?? row.retail : row.reseller ?? row.retail;
        const price = computeBulkPrice(base, mode, value, round);
        if (price == null) {
          skipped += 1;
          continue;
        }
        out.push({ product_name: row.product_name, duration: row.duration, base, old, price });
      }
      return { out, skipped };
    };

    if (action === "preview") {
      const first = build(usernames[0]);
      return NextResponse.json(
        {
          success: true,
          resellers: usernames.length,
          rows_per_reseller: first.out.length,
          skipped: first.skipped,
          sample: first.out.slice(0, 400),
          previewing: usernames[0],
        },
        { headers: NO_STORE }
      );
    }

    let total = 0;
    let skipped = 0;
    const now = new Date().toISOString();
    for (const username of usernames) {
      const built = build(username);
      skipped += built.skipped;
      const rows = built.out.map((r) => ({ username, product_name: r.product_name, duration: r.duration, reseller_price: r.price, updated_at: now }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabaseAdmin
          .from("reseller_price_overrides")
          .upsert(rows.slice(i, i + 500), { onConflict: "username,product_name,duration" });
        if (error) {
          console.error("VIP BULK SAVE ERROR:", error.message);
          return fail(`Saved ${total} rows, then failed at "${username}". Run it again to finish.`, 500);
        }
      }
      total += rows.length;
    }

    return NextResponse.json({ success: true, rows: total, resellers: usernames.length, skipped }, { headers: NO_STORE });
  } catch (error: any) {
    console.error("VIP BULK ERROR:", error?.message);
    return fail("Bulk VIP change failed.", 500);
  }
}
