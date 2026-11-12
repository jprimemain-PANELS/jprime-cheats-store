import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const files: string[] = [];
(function walk(dir: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "tests", ".git"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
})(ROOT);
const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, "/");

// The ONLY modules allowed to hold the service-role client. Everything else must go through tdb().
const ALLOWED_SERVICE_ROLE = new Set([
  "lib/supabase-admin.ts",
  "lib/tenant-db.ts",   // tenant-scoped helpers
  "lib/tenant.ts",      // tenants / tenant_domains lookups (not tenant-owned tables)
  "lib/wallet.ts",      // jprime_t_* RPCs (tenant is an explicit argument)
  "app/api/verify-wallet-payment/route.ts", // jprime_t_finalize_wallet_deposit RPC with tenant id
  "app/api/payment-webhook/route.ts",       // owner-only legacy webhook RPC (no tenant data read)
  "lib/payment-gateway.ts", // reads/writes ONLY app_settings (owner-level gateway config), never a tenant table
  "lib/user-admin.ts",      // delete user: tenant-scoped via tdb + audit/tenants lookups; caller passes requireTenantAdmin
  "lib/api-system.ts",      // API system: connections table + wallet-backed API stock lookups; callers pass tenant-admin guards
  "lib/subscription.ts",    // subscriptions + instant launch: tenants/applications/wallet RPCs; callers pass user/tenant-admin guards
  "lib/domains.ts",         // custom-domain flow: tenant_domains + audit only; callers pass owner/tenant-admin guards
  "lib/tenant-admin.ts",    // platform tables only (tenants/applications/settings/audit) + 003 RPCs; callers pass owner/tenant-admin guards
  "lib/telegram.ts",        // reads ONLY app_settings (owner telegram destinations); skips non-owner stores
  "lib/store-options.ts",   // reads ONLY app_settings keys prefixed per store (store_options); owner-only writes of resellerLaunch
  "lib/upgrade-reseller.ts", // users role update scoped by id + tenant_id + current role; wallet via tenant RPCs
  "lib/deposit-recheck.ts", // admin recheck of ONE deposit by order id inside the admin tenant; credit only through the atomic RPC
]);

describe("static tenant-isolation guard", () => {
  it("only allow-listed modules import the service-role client", () => {
    const offenders = files.filter(
      (f) => /lib\/supabase-admin["']/.test(fs.readFileSync(f, "utf8")) && !ALLOWED_SERVICE_ROLE.has(rel(f))
    );
    expect(offenders.map(rel)).toEqual([]);
  });
  it("no code calls the old username-only wallet functions", () => {
    const bad = files.filter((f) => /rpc\(\s*["']jprime_(wallet_|finalize_wallet_deposit)/.test(fs.readFileSync(f, "utf8")));
    expect(bad.map(rel)).toEqual([]);
  });
  it("the anon Supabase client is not used anywhere in app code", () => {
    const bad = files.filter((f) => rel(f) !== "lib/supabase.ts" && /from\s+["']@\/lib\/supabase["']/.test(fs.readFileSync(f, "utf8")));
    expect(bad.map(rel)).toEqual([]);
  });
  it("the retired tenant-unaware session module is gone", () => {
    expect(fs.existsSync(path.join(ROOT, "lib/server-session.ts"))).toBe(false);
  });
  it("tenant-owned tables are never queried from the allow-listed RPC-only modules", () => {
    const tenantTables = ["users", "wallets", "wallet_transactions", "deposit_history", "payment_orders",
      "purchase_history", "stock_keys", "product_prices", "products_catalog", "reseller_price_overrides"];
    for (const f of ["lib/wallet.ts", "app/api/verify-wallet-payment/route.ts", "app/api/payment-webhook/route.ts", "lib/tenant.ts"]) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      for (const t of tenantTables) expect(src.includes(`supabaseAdmin.from("${t}")`) || src.includes(`supabaseAdmin\n      .from("${t}")`)).toBe(false);
    }
  });
});

describe("layout keeps the real site fonts", () => {
  it("imports Geist from next/font/google (not a stub)", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf8");
    expect(src).toContain("import { Geist, Geist_Mono } from 'next/font/google'");
  });
});
