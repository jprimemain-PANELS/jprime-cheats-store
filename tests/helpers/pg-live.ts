/** Builds an in-memory real Postgres (PGlite) shaped like the LIVE database, from tests/fixtures/live-schema.json. */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

export const TABLES = ["users", "wallets", "wallet_transactions", "deposit_history", "payment_orders",
  "purchase_history", "stock_keys", "product_prices", "products_catalog", "reseller_price_overrides"];
export const OWNER = "00000000-0000-0000-0000-000000000001";
const ROOT = path.resolve(__dirname, "../..");
export const readSql = (f: string) => fs.readFileSync(path.join(ROOT, "supabase/tenant", f), "utf8");

export async function buildLiveDb(): Promise<PGlite> {
  const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/live-schema.json"), "utf8"));
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
                 GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;`);
  const cols = fixture.columns.filter((c: any) => TABLES.includes(c.t));
  for (const t of TABLES) {
    const defs = cols.filter((c: any) => c.t === t).map((c: any) =>
      `"${c.c}" ${c.type}${c.null === "NO" ? " NOT NULL" : ""}${c.default ? ` DEFAULT ${c.default}` : ""}${c.c === "id" ? " PRIMARY KEY" : ""}`);
    await db.exec(`CREATE TABLE public.${t} (${defs.join(", ")});`);
  }
  for (const def of fixture.live_indexes as string[]) {
    const m = def.match(/ON public\.(\w+)/);
    if (!m || !TABLES.includes(m[1]) || /_pkey\b|products_catalog_product_id_key/.test(def)) continue;
    await db.exec(def);
  }
  await db.exec(`ALTER TABLE public.products_catalog ADD CONSTRAINT products_catalog_product_id_key UNIQUE (product_id);`);
  return db;
}
