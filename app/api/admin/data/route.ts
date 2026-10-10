import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth";
import { allProducts } from "@/lib/products";
import { creditWallet, debitWallet, getBalance, logWalletTransaction } from "@/lib/wallet";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const STATUS_ROW = "__status__";
const ROLES = ["user", "reseller", "admin"];

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status, headers: NO_STORE });
}

/**
 * GET  /api/admin/data  -> everything the admin dashboard needs (admin session required).
 * POST /api/admin/data  -> { action, ... } admin mutations. Every call re-checks the admin session.
 * Password hashes are NEVER returned.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const [stock, users, wallets, purchases, prices, catalog] = await Promise.all([
      supabaseAdmin.from("stock_keys").select("*").eq("is_used", false),
      supabaseAdmin.from("users").select("*"),
      supabaseAdmin.from("wallets").select("username, balance"),
      supabaseAdmin.from("purchase_history").select("*").order("id", { ascending: false }).limit(5000),
      supabaseAdmin.from("product_prices").select("*"),
      supabaseAdmin.from("products_catalog").select("product_id, name, data").order("id", { ascending: true }),
    ]);

    const firstError = stock.error || users.error || wallets.error || purchases.error || prices.error || catalog.error;
    if (firstError) {
      console.error("ADMIN DATA ERROR:", firstError.message);
      return fail("Could not load admin data.", 500);
    }

    const safeUsers = (users.data || []).map((u: any) => {
      const { password, ...rest } = u;
      return rest;
    });

    const catalogProducts = (catalog.data || [])
      .map((row: any) => {
        const product = row?.data && typeof row.data === "object" ? row.data : null;
        if (!product) return null;
        return { ...product, id: String(product.id || row.product_id || ""), name: String(product.name || row.name || "") };
      })
      .filter((product: any) => Boolean(product?.id && product?.name && Array.isArray(product?.prices)));

    // Quick-control tabs use the live catalog. The built-in list remains only as a fallback
    // for an empty catalog; importing it is handled separately by /api/admin/legacy-products.
    const dashboardProducts = catalogProducts.length ? catalogProducts : allProducts;

    return NextResponse.json(
      {
        success: true,
        keys: stock.data || [],
        users: safeUsers,
        wallets: wallets.data || [],
        purchases: purchases.data || [],
        priceRows: prices.data || [],
        products: dashboardProducts,
        me: { username: auth.user.username },
      },
      { headers: NO_STORE }
    );
  } catch (e) {
    console.error("ADMIN DATA EXCEPTION:", e instanceof Error ? e.message : "unknown");
    return fail("Could not load admin data.", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "");

    /* ---------- stock ---------- */
    if (action === "stock_count") {
      const { count, error } = await supabaseAdmin
        .from("stock_keys")
        .select("id", { count: "exact", head: true })
        .eq("product_name", String(body.product_name || ""))
        .eq("duration", String(body.duration || ""))
        .eq("is_used", false);
      if (error) return fail("Could not count stock.", 500);
      return NextResponse.json({ success: true, count: count ?? 0 }, { headers: NO_STORE });
    }

    if (action === "add_stock") {
      const productName = String(body.product_name || "").trim();
      const duration = String(body.duration || "").trim();
      const keys: string[] = (Array.isArray(body.keys) ? body.keys : [])
        .map((k: unknown) => String(k ?? "").trim())
        .filter(Boolean)
        .slice(0, 2000);

      if (!productName || !duration || keys.length === 0) return fail("Missing product, duration or keys.");

      const { error } = await supabaseAdmin.from("stock_keys").insert(
        keys.map((key_code) => ({ product_name: productName, duration, key_code, is_used: false }))
      );
      if (error) {
        console.error("ADD STOCK ERROR:", error.message);
        return fail("Could not add stock.", 500);
      }
      return NextResponse.json({ success: true }, { headers: NO_STORE });
    }

    if (action === "delete_stock") {
      const id = Number(body.id);
      if (!Number.isFinite(id)) return fail("Invalid id.");
      const { error } = await supabaseAdmin.from("stock_keys").delete().eq("id", id);
      if (error) return fail("Could not delete key.", 500);
      return NextResponse.json({ success: true }, { headers: NO_STORE });
    }

    /* ---------- prices / status ---------- */
    if (action === "save_prices") {
      const rows: any[] = Array.isArray(body.rows) ? body.rows : [];
      const clean: any[] = [];

      for (const r of rows.slice(0, 200)) {
        const product_name = String(r?.product_name || "").trim();
        const duration = String(r?.duration || "").trim();
        const price = Number(r?.price_inr);
        const reseller =
          r?.reseller_price === null || r?.reseller_price === undefined || r?.reseller_price === ""
            ? null
            : Number(r.reseller_price);

        if (!product_name || !duration || duration === STATUS_ROW) return fail("Invalid price row.");
        if (!Number.isFinite(price) || price <= 0) return fail(`Invalid price for "${duration}".`);
        if (reseller !== null && (!Number.isFinite(reseller) || reseller <= 0)) {
          return fail(`Invalid reseller price for "${duration}".`);
        }
        clean.push({ product_name, duration, price_inr: price, reseller_price: reseller });
      }

      if (clean.length === 0) return fail("Nothing to save.");

      const { error } = await supabaseAdmin
        .from("product_prices")
        .upsert(clean, { onConflict: "product_name,duration" });
      if (error) {
        console.error("SAVE PRICES ERROR:", error.message);
        return fail("Could not save prices.", 500);
      }
      return NextResponse.json({ success: true }, { headers: NO_STORE });
    }

    if (action === "set_status") {
      const productName = String(body.product_name || "").trim();
      const status = String(body.status || "");
      if (!productName || (status !== "ONLINE" && status !== "MAINTENANCE")) return fail("Invalid status.");

      const { error } = await supabaseAdmin.from("product_prices").upsert(
        {
          product_name: productName,
          duration: STATUS_ROW,
          price_inr: status === "MAINTENANCE" ? 1 : 0,
          reseller_price: null,
        },
        { onConflict: "product_name,duration" }
      );
      if (error) return fail("Could not save status.", 500);
      return NextResponse.json({ success: true }, { headers: NO_STORE });
    }

    /* ---------- users / wallets ---------- */
    if (action === "update_user") {
      const username = String(body.username || "").trim();
      if (!username) return fail("Missing username.");

      const { data: target, error: targetError } = await supabaseAdmin
        .from("users")
        .select("username, role")
        .eq("username", username)
        .maybeSingle();
      if (targetError || !target) return fail("User not found.", 404);

      if (body.role !== undefined && String(body.role) !== target.role) {
        const role = String(body.role);
        if (!ROLES.includes(role)) return fail("Invalid role.");
        if (username === auth.user.username) return fail("You cannot change your own role.");

        const { error } = await supabaseAdmin.from("users").update({ role }).eq("username", username);
        if (error) return fail("Could not update role.", 500);
      }

      const action2 = String(body.balanceAction || "none");
      const amount = Math.round(Number(body.amount) * 100) / 100;

      if ((action2 === "add" || action2 === "remove") && Number.isFinite(amount) && amount > 0) {
        if (amount > 1_000_000) return fail("Amount too large.");

        let newBalance: number | null = null;
        let applied = amount;

        if (action2 === "add") {
          const r = await creditWallet(username, amount);
          if (!r.ok) return fail("Could not update wallet.", 500);
          newBalance = r.balance;
        } else {
          const current = await getBalance(username);
          if (current === null) return fail("Could not update wallet.", 500);
          applied = Math.min(amount, current); // never below zero (same as before)
          if (applied > 0) {
            const r = await debitWallet(username, applied);
            if (!r.ok) return fail("Could not update wallet.", 500);
            newBalance = r.balance;
          }
        }

        if (newBalance !== null) {
          await logWalletTransaction({
            username,
            type: action2 === "add" ? "credit" : "debit",
            amount: applied,
            balance_after: newBalance,
            description: `Admin ${action2 === "add" ? "added" : "removed"} funds`,
          });
        }
      }

      return NextResponse.json({ success: true }, { headers: NO_STORE });
    }

    return fail("Unknown action.");
  } catch (e) {
    console.error("ADMIN ACTION ERROR:", e instanceof Error ? e.message : "unknown");
    return fail("Admin action failed.", 500);
  }
}
