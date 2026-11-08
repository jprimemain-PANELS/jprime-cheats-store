/**
 * Runs the REAL migration SQL files against a real Postgres engine (PGlite, WASM) built from your
 * live schema (tests/fixtures/live-schema.json, taken from your Phase 0 introspection).
 * Proves: nothing is lost by 001, wallets/deposits are isolated per tenant in SQL, public roles
 * cannot call the new functions, 002 and the rollback behave. It does NOT prove behaviour under
 * concurrent connections or Supabase-specific features (PGlite is a single connection).
 */
import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ROOT = path.resolve(__dirname, "..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, "supabase/tenant", f), "utf8");
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/live-schema.json"), "utf8"));

const TABLES = ["users", "wallets", "wallet_transactions", "deposit_history", "payment_orders",
  "purchase_history", "stock_keys", "product_prices", "products_catalog", "reseller_price_overrides"];
const OWNER = "00000000-0000-0000-0000-000000000001";
const B = "00000000-0000-0000-0000-0000000000b2";

let db: PGlite;
const q = async (sql: string, params?: any[]) => (await db.query<any>(sql, params)).rows;
const one = async (sql: string, params?: any[]) => (await q(sql, params))[0];
const rpc = async (fn: string, ...args: any[]) =>
  (await one(`SELECT public.${fn}(${args.map((_, i) => `$${i + 1}`).join(",")}) AS r`, args)).r;

async function buildLiveSchema() {
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
  // products_catalog had a UNIQUE(product_id) constraint in the live DB
  await db.exec(`ALTER TABLE public.products_catalog ADD CONSTRAINT products_catalog_product_id_key UNIQUE (product_id);`);
}

async function seedLiveData() {
  await db.exec(`
    INSERT INTO public.users (id, username, password, role) VALUES
      ('u1','raj','x','user'), ('u2','raj','x','user'), ('u3','boss','x','admin');
    INSERT INTO public.wallets (id, username, balance) VALUES
      ('w1','raj',100), ('w2','raj',50), ('w3','boss',7.5);
    INSERT INTO public.wallet_transactions (id, username, amount, type, balance_after) VALUES ('t1','raj','100','deposit','100');
    INSERT INTO public.deposit_history (id, username, gateway_order_id, amount, status) VALUES
      ('d1','raj','ORD1','10','pending'), ('d2','raj','ORD2','20','success');
    INSERT INTO public.payment_orders (id, username, gateway_order_id, amount, status) VALUES ('o1','raj','GO1',10,'pending');
    INSERT INTO public.purchase_history (id, username, product_name, duration, key_code) VALUES ('p1','raj','P','1d','K');
    INSERT INTO public.stock_keys (id, product_name, duration, key_code, is_used) VALUES ('s1','P','1d','K1','false');
    INSERT INTO public.product_prices (id, product_name, duration, price_inr) VALUES ('pp1','P','1d','100');
    INSERT INTO public.products_catalog (id, product_id, name, data) VALUES ('c1','p1','P','{}');
    INSERT INTO public.reseller_price_overrides (id, username, product_name, duration, reseller_price) VALUES ('r1','raj','P','1d','90');
  `);
}

const counts = async () => {
  const out: Record<string, number> = {};
  for (const t of TABLES) out[t] = Number((await one(`SELECT count(*) c FROM public.${t}`)).c);
  out.balance = Number((await one(`SELECT sum(balance) s FROM public.wallets`)).s);
  return out;
};

let before: Record<string, number>;

beforeAll(async () => {
  db = new PGlite();
  await buildLiveSchema();
  await seedLiveData();
  before = await counts();
});

describe("001 foundation migration on a copy of the live schema", () => {
  it("runs without error and loses nothing", async () => {
    await db.exec(read("001_TENANT_FOUNDATION.sql"));
    expect(await counts()).toEqual(before);
  });

  it("every existing row now belongs to the JPRIME owner tenant", async () => {
    for (const t of TABLES) {
      const r = await one(`SELECT count(*) FILTER (WHERE tenant_id <> $1) bad, count(*) total FROM public.${t}`, [OWNER]);
      expect(Number(r.bad), t).toBe(0);
      expect(Number(r.total), t).toBe(before[t]);
    }
  });

  it("creates exactly one owner tenant with its domains", async () => {
    expect((await q(`SELECT slug FROM public.tenants WHERE kind='owner'`)).map((r) => r.slug)).toEqual(["jprime"]);
    expect((await q(`SELECT host FROM public.tenant_domains ORDER BY host`)).map((r) => r.host))
      .toEqual(["jprimecheats.store", "www.jprimecheats.store"]);
    await expect(db.exec(`INSERT INTO public.tenants (slug, kind, brand_name) VALUES ('second-owner','owner','x')`)).rejects.toThrow();
  });

  it("is safe to run twice", async () => {
    await db.exec(read("001_TENANT_FOUNDATION.sql"));
    expect(await counts()).toEqual(before);
  });
});

describe("tenant-aware wallet functions (real SQL)", () => {
  beforeAll(async () => {
    await db.exec(`INSERT INTO public.tenants (id, slug, kind, status, brand_name) VALUES ('${B}', 'andrews', 'coadmin', 'active', 'Andrews')`);
  });

  it("the same username has independent wallets per tenant", async () => {
    // owner 'raj' had two duplicate rows (100 + 50): consolidated inside the OWNER tenant only
    expect(Number(await rpc("jprime_t_wallet_get_balance", OWNER, "raj"))).toBe(150);
    expect(Number(await rpc("jprime_t_wallet_get_balance", B, "raj"))).toBe(0);
    expect((await rpc("jprime_t_wallet_credit", B, "raj", 40)).balance).toBe(40);
    expect(Number(await rpc("jprime_t_wallet_get_balance", OWNER, "raj"))).toBe(150); // untouched
    expect(Number(await rpc("jprime_t_wallet_get_balance", B, "raj"))).toBe(40);
  });

  it("a debit in one tenant can never spend another tenant's balance", async () => {
    const r = await rpc("jprime_t_wallet_debit", B, "raj", 100);
    expect(r).toMatchObject({ ok: false, reason: "insufficient", balance: 40 });
    expect(Number(await rpc("jprime_t_wallet_get_balance", OWNER, "raj"))).toBe(150);
    expect((await rpc("jprime_t_wallet_debit", B, "raj", 15.25)).balance).toBe(24.75);
  });

  it("rejects invalid input and a missing tenant", async () => {
    expect(await rpc("jprime_t_wallet_credit", B, "raj", -5)).toMatchObject({ ok: false, reason: "invalid" });
    expect(await rpc("jprime_t_wallet_credit", B, "raj", 0)).toMatchObject({ ok: false, reason: "invalid" });
    await expect(rpc("jprime_t_wallet_get_balance", B, "  ")).rejects.toThrow();
  });

  it("total money is conserved by the owner-tenant consolidation", async () => {
    const owner = await one(`SELECT sum(balance) s FROM public.wallets WHERE tenant_id=$1`, [OWNER]);
    expect(Number(owner.s)).toBe(150 + 7.5);
  });
});

describe("deposit finalizer (real SQL)", () => {
  const UTR1 = "123456789012", UTR2 = "999999999999";

  it("credits exactly once and writes the ledger row for the same tenant", async () => {
    const r = await rpc("jprime_t_finalize_wallet_deposit", OWNER, "ORD1", "raj", UTR1, 10);
    expect(r).toMatchObject({ ok: true, status: "success", balance: 160 });
    expect(await rpc("jprime_t_finalize_wallet_deposit", OWNER, "ORD1", "raj", UTR1, 10)).toMatchObject({ ok: false, status: "already_verified" });
    expect(Number(await rpc("jprime_t_wallet_get_balance", OWNER, "raj"))).toBe(160);
    const tx = await one(`SELECT tenant_id, type FROM public.wallet_transactions WHERE description='Wallet Deposit Verification Successful'`);
    expect(tx).toMatchObject({ tenant_id: OWNER, type: "deposit" });
  });

  it("another tenant cannot finalize a deposit that belongs to this tenant", async () => {
    await db.exec(`INSERT INTO public.deposit_history (id, username, gateway_order_id, amount, status, tenant_id) VALUES ('d3','raj','ORD3','5','pending','${OWNER}')`);
    expect(await rpc("jprime_t_finalize_wallet_deposit", B, "ORD3", "raj", UTR2, 5)).toMatchObject({ ok: false, status: "not_found" });
    expect(Number(await rpc("jprime_t_wallet_get_balance", B, "raj"))).toBe(24.75);
  });

  it("a bank reference (UTR) can settle only one payment, even across tenants", async () => {
    await db.exec(`INSERT INTO public.deposit_history (id, username, gateway_order_id, amount, status, tenant_id) VALUES ('d4','raj','ORD4','10','pending','${B}')`);
    expect(await rpc("jprime_t_finalize_wallet_deposit", B, "ORD4", "raj", UTR1, 10)).toMatchObject({ ok: false, status: "duplicate_utr" });
    expect(Number(await rpc("jprime_t_wallet_get_balance", B, "raj"))).toBe(24.75);
  });

  it("amount mismatch and bad UTR are rejected without crediting", async () => {
    expect(await rpc("jprime_t_finalize_wallet_deposit", OWNER, "ORD3", "raj", UTR2, 6)).toMatchObject({ status: "amount_mismatch" });
    expect(await rpc("jprime_t_finalize_wallet_deposit", OWNER, "ORD3", "raj", "123", 5)).toMatchObject({ status: "invalid_request" });
  });
});

describe("permissions", () => {
  it("public roles (anon / authenticated) cannot call the new functions or read the new tables", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`);
      try {
        await expect(db.query(`SELECT public.jprime_t_wallet_get_balance('${OWNER}','raj')`)).rejects.toThrow(/permission denied/i);
        await expect(db.query(`SELECT * FROM public.tenants`)).rejects.toThrow(/permission denied/i);
        await expect(db.query(`SELECT * FROM public.audit_log`)).rejects.toThrow(/permission denied/i);
      } finally {
        await db.exec(`RESET ROLE`);
      }
    }
  });
  it("service_role can", async () => {
    await db.exec(`SET ROLE service_role`);
    try {
      await expect(db.query(`SELECT public.jprime_t_wallet_get_balance('${OWNER}','raj')`)).resolves.toBeTruthy();
      await expect(db.query(`SELECT count(*) FROM public.tenants`)).resolves.toBeTruthy();
    } finally {
      await db.exec(`RESET ROLE`);
    }
  });
});

describe("002 contract step", () => {
  it("runs, keeps going past existing duplicate usernames (skips that index) and loses nothing", async () => {
    const pre = await counts();
    await db.exec(read("002_CONTRACT_AFTER_CODE_DEPLOY.sql"));
    expect(await counts()).toEqual(pre);
    // duplicate 'raj' users exist in the owner tenant -> the unique users index must NOT have been created
    expect(await q(`SELECT 1 FROM pg_indexes WHERE indexname='users_tenant_username_uidx'`)).toHaveLength(0);
  });
  it("two stores can now sell the same product/price rows", async () => {
    await db.exec(`INSERT INTO public.product_prices (id, product_name, duration, price_inr, tenant_id) VALUES ('ppB','P','1d','80','${B}')`);
    await db.exec(`INSERT INTO public.products_catalog (id, product_id, name, data, tenant_id) VALUES ('cB','p1','P','{}','${B}')`);
    await db.exec(`INSERT INTO public.reseller_price_overrides (id, username, product_name, duration, reseller_price, tenant_id) VALUES ('rB','raj','P','1d','70','${B}')`);
    // but inside ONE tenant duplicates are still rejected
    await expect(db.exec(`INSERT INTO public.product_prices (id, product_name, duration, price_inr, tenant_id) VALUES ('ppB2','P','1d','1','${B}')`)).rejects.toThrow();
  });
  it("unique (tenant, username) is enforced once duplicates are resolved", async () => {
    await db.exec(`DELETE FROM public.users WHERE id = 'u2'`); // test data only
    await db.exec(read("002_CONTRACT_AFTER_CODE_DEPLOY.sql"));
    await expect(db.exec(`INSERT INTO public.users (id, username, password, tenant_id) VALUES ('uX','raj','x','${OWNER}')`)).rejects.toThrow();
    await db.exec(`INSERT INTO public.users (id, username, password, tenant_id) VALUES ('uY','raj','x','${B}')`); // same name, other store: allowed
  });
});

describe("rollback", () => {
  it("removes only what 001 added; original rows survive", async () => {
    await db.exec(`DELETE FROM public.product_prices WHERE tenant_id='${B}'; DELETE FROM public.products_catalog WHERE tenant_id='${B}';
                   DELETE FROM public.reseller_price_overrides WHERE tenant_id='${B}'; DELETE FROM public.users WHERE tenant_id='${B}';
                   DELETE FROM public.deposit_history WHERE tenant_id='${B}'; DELETE FROM public.wallets WHERE tenant_id='${B}';
                   DELETE FROM public.wallet_transactions WHERE tenant_id='${B}';`);
    await db.exec(read("001_ROLLBACK.sql"));
    expect(await q(`SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tenant_id'`)).toHaveLength(0);
    expect(await q(`SELECT 1 FROM pg_tables WHERE tablename='tenants'`)).toHaveLength(0);
    expect(Number((await one(`SELECT count(*) c FROM public.wallets`)).c)).toBeGreaterThan(0);
    expect(Number((await one(`SELECT count(*) c FROM public.purchase_history`)).c)).toBe(before.purchase_history);
  });
});
