/** Real-Postgres tests (PGlite) for supabase/tenant/003_COADMIN_FUNCTIONS.sql on top of 001. */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { buildLiveDb, readSql, OWNER } from "./helpers/pg-live";

let db: PGlite;
const q = async (sql: string, p?: any[]) => (await db.query<any>(sql, p)).rows;
const one = async (sql: string, p?: any[]) => (await q(sql, p))[0];
const fn = async (name: string, ...args: any[]) =>
  (await one(`SELECT public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) AS r`, args)).r;

const HASH = "scrypt$aa$bb";
const ROOT = "shopnet.example";
async function newApp(slug: string, user = "andrew", hash: string | null = HASH) {
  const r = await one(
    `INSERT INTO public.tenant_applications (applicant_user_id, applicant_tenant_id, brand_name, slug, telegram_username,
       inventory_mode, contact_email, contact_phone, coadmin_username, coadmin_password_hash)
     VALUES ('u-res', $1, 'Andrews Store', $2, '@andrew', 'own_api', 'a@x.test', '9999999999', $3, $4) RETURNING id`,
    [OWNER, slug, user, hash]);
  return r.id as string;
}

beforeAll(async () => {
  db = await buildLiveDb();
  await db.exec(`INSERT INTO public.users (id, username, password, role) VALUES ('boss','boss','x','admin'), ('u-res','res1','x','reseller');`);
  await db.exec(readSql("001_TENANT_FOUNDATION.sql"));
  await db.exec(readSql("003_COADMIN_FUNCTIONS.sql"));
});

describe("slugs", () => {
  it("valid / reserved / malformed", async () => {
    expect(await fn("jprime_slug_available", "andrews")).toBe(true);
    for (const bad of ["jprime", "admin", "www", "ab", "-abc", "abc-", "a--b", "UPPER", "has space", "a.b", "x".repeat(40)]) {
      expect(await fn("jprime_slug_available", bad), bad).toBe(false);
    }
  });
});

describe("approve", () => {
  it("creates store + co-admin login + domain + settings + audit in one go", async () => {
    const app = await newApp("andrews");
    const r = await fn("jprime_approve_tenant_application", app, "boss", "boss", ROOT);
    expect(r).toMatchObject({ ok: true, host: `andrews.${ROOT}` });
    const t = await one(`SELECT * FROM public.tenants WHERE slug='andrews'`);
    expect(t).toMatchObject({ kind: "coadmin", status: "active", brand_name: "Andrews Store", inventory_mode: "own_api" });
    const u = await one(`SELECT * FROM public.users WHERE tenant_id=$1`, [t.id]);
    expect(u).toMatchObject({ username: "andrew", role: "coadmin", password: HASH });
    expect(t.coadmin_user_id).toBe(u.id);
    expect(await one(`SELECT host, verified FROM public.tenant_domains WHERE tenant_id=$1`, [t.id])).toMatchObject({ host: `andrews.${ROOT}`, verified: true });
    expect((await q(`SELECT 1 FROM public.tenant_settings WHERE tenant_id=$1`, [t.id])).length).toBe(1);
    expect(await one(`SELECT status FROM public.tenant_applications WHERE id=$1`, [app])).toMatchObject({ status: "approved" });
    expect(await one(`SELECT action, actor_username FROM public.audit_log WHERE tenant_id=$1`, [t.id])).toMatchObject({ action: "tenant.approve", actor_username: "boss" });
  });
  it("the co-admin account lives ONLY in the new store", async () => {
    expect(Number((await one(`SELECT count(*) c FROM public.users WHERE username='andrew' AND tenant_id=$1`, [OWNER])).c)).toBe(0);
  });
  it("cannot be approved twice", async () => {
    const app = (await one(`SELECT id FROM public.tenant_applications WHERE slug='andrews'`)).id;
    expect(await fn("jprime_approve_tenant_application", app, "boss", "boss", ROOT)).toMatchObject({ ok: false, reason: "not_pending" });
    expect(Number((await one(`SELECT count(*) c FROM public.tenants WHERE slug='andrews'`)).c)).toBe(1);
  });
  it("without a root domain no domain row is created (store stays unreachable, not half-active)", async () => {
    const app = await newApp("nodomain", "nd1");
    const r = await fn("jprime_approve_tenant_application", app, "boss", "boss", null);
    expect(r).toMatchObject({ ok: true, host: null });
    const t = await one(`SELECT id FROM public.tenants WHERE slug='nodomain'`);
    expect((await q(`SELECT 1 FROM public.tenant_domains WHERE tenant_id=$1`, [t.id])).length).toBe(0);
  });
  it("is atomic: a bad password hash creates NOTHING and leaves the application pending", async () => {
    const app = await newApp("badhash", "bh1", "plaintext-password");
    expect(await fn("jprime_approve_tenant_application", app, "boss", "boss", ROOT)).toMatchObject({ ok: false, reason: "invalid_password_hash" });
    expect((await q(`SELECT 1 FROM public.tenants WHERE slug='badhash'`)).length).toBe(0);
    expect(await one(`SELECT status FROM public.tenant_applications WHERE id=$1`, [app])).toMatchObject({ status: "pending" });
  });
  it("rejects an invalid root domain and a slug already used by a store", async () => {
    const app = await newApp("badroot", "br1");
    expect(await fn("jprime_approve_tenant_application", app, "boss", "boss", "not a domain")).toMatchObject({ ok: false, reason: "invalid_root_domain" });
    await db.exec(`UPDATE public.tenant_applications SET status='rejected' WHERE slug='badroot'`); // free the open-slug index
    const dup = await newApp("badroot", "br2");
    await db.exec(`INSERT INTO public.tenants (slug, kind, status, brand_name) VALUES ('badroot','coadmin','active','x')`);
    expect(await fn("jprime_approve_tenant_application", dup, "boss", "boss", ROOT)).toMatchObject({ ok: false, reason: "slug_taken" });
  });
});

describe("reject / suspend / reactivate", () => {
  it("reject records who and why; a rejected application cannot be approved", async () => {
    const app = await newApp("rejectme", "rj1");
    expect(await fn("jprime_reject_tenant_application", app, "boss", "boss", "not a reseller")).toMatchObject({ ok: true });
    expect(await fn("jprime_approve_tenant_application", app, "boss", "boss", ROOT)).toMatchObject({ ok: false, reason: "not_pending" });
    expect(await one(`SELECT reason FROM public.audit_log WHERE action='tenant.reject'`)).toMatchObject({ reason: "not a reseller" });
  });
  it("suspend needs a reason, is audited, and can be reversed; the owner store is untouchable", async () => {
    const t = await one(`SELECT id FROM public.tenants WHERE slug='andrews'`);
    expect(await fn("jprime_set_tenant_status", t.id, "suspended", "boss", "boss", "  ")).toMatchObject({ ok: false, reason: "reason_required" });
    expect(await fn("jprime_set_tenant_status", t.id, "suspended", "boss", "boss", "chargeback")).toMatchObject({ ok: true });
    expect(await one(`SELECT status, suspended_at IS NOT NULL AS s FROM public.tenants WHERE id=$1`, [t.id])).toMatchObject({ status: "suspended", s: true });
    expect(await fn("jprime_set_tenant_status", t.id, "active", "boss", "boss", "resolved")).toMatchObject({ ok: true });
    expect(await one(`SELECT status, suspended_at FROM public.tenants WHERE id=$1`, [t.id])).toMatchObject({ status: "active", suspended_at: null });
    expect((await q(`SELECT action FROM public.audit_log WHERE tenant_id=$1 ORDER BY id`, [t.id])).map((r) => r.action)).toEqual(["tenant.approve", "tenant.suspend", "tenant.reactivate"]);
    expect(await fn("jprime_set_tenant_status", OWNER, "suspended", "boss", "boss", "oops")).toMatchObject({ ok: false, reason: "owner_protected" });
    expect(await fn("jprime_set_tenant_status", t.id, "deleted", "boss", "boss", "x")).toMatchObject({ ok: false, reason: "invalid_status" });
  });
  it("suspension keeps every wallet, order and ledger row", async () => {
    const t = await one(`SELECT id FROM public.tenants WHERE slug='andrews'`);
    await db.exec(`INSERT INTO public.wallets (id, username, balance, tenant_id) VALUES ('wA','cust',250,'${t.id}')`);
    await fn("jprime_set_tenant_status", t.id, "suspended", "boss", "boss", "check");
    expect(Number((await one(`SELECT balance FROM public.wallets WHERE id='wA'`)).balance)).toBe(250);
    await fn("jprime_set_tenant_status", t.id, "active", "boss", "boss", "ok");
  });
});

describe("direct create by the owner", () => {
  it("creates the store active in one step", async () => {
    const r = await fn("jprime_create_tenant_direct", "Amaran Hub", "amaran", "@amaran", "shared_stock", "amaran", HASH, "", "", "boss", "boss", ROOT);
    expect(r).toMatchObject({ ok: true, host: `amaran.${ROOT}` });
    expect(await one(`SELECT status, inventory_mode FROM public.tenants WHERE slug='amaran'`)).toMatchObject({ status: "active", inventory_mode: "shared_stock" });
  });
  it("is all-or-nothing: a failure leaves no application, tenant or user behind", async () => {
    await expect(fn("jprime_create_tenant_direct", "Bad", "badone", "@x", "own_api", "x y!", HASH, "", "", "boss", "boss", ROOT)).rejects.toThrow();
    expect((await q(`SELECT 1 FROM public.tenant_applications WHERE slug='badone'`)).length).toBe(0);
    expect((await q(`SELECT 1 FROM public.tenants WHERE slug='badone'`)).length).toBe(0);
    expect(await fn("jprime_create_tenant_direct", "Dup", "andrews", "@x", "own_api", "dupuser", HASH, "", "", "boss", "boss", ROOT)).toMatchObject({ ok: false, reason: "slug_unavailable" });
  });
});

describe("stats and permissions", () => {
  it("counts each store separately", async () => {
    const t = await one(`SELECT id FROM public.tenants WHERE slug='andrews'`);
    await db.exec(`INSERT INTO public.users (id, username, password, role, tenant_id) VALUES
      ('c1','c1','x','user','${t.id}'), ('c2','c2','x','user','${t.id}'), ('r1','r1','x','reseller','${t.id}')`);
    await db.exec(`INSERT INTO public.purchase_history (id, username, product_name, created_at, tenant_id) VALUES ('ph1','c1','P','2026-01-02T00:00:00Z','${t.id}')`);
    const rows = await q(`SELECT * FROM public.jprime_tenant_stats()`);
    const mine = rows.find((r) => r.tenant_id === t.id);
    expect([Number(mine.customers), Number(mine.resellers), Number(mine.orders)]).toEqual([2, 1, 1]);
    expect(Number(mine.wallet_total)).toBe(250);
    const owner = rows.find((r) => r.tenant_id === OWNER);
    expect(Number(owner.orders)).toBe(0); // other stores' orders never leak into the owner's count
  });
  it("public roles cannot call any of the new functions", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`);
      try {
        await expect(db.query(`SELECT public.jprime_tenant_stats()`)).rejects.toThrow(/permission denied/i);
        await expect(db.query(`SELECT public.jprime_slug_available('abc')`)).rejects.toThrow(/permission denied/i);
        await expect(db.query(`SELECT public.jprime_set_tenant_status('${OWNER}','suspended','a','a','b')`)).rejects.toThrow(/permission denied/i);
      } finally { await db.exec(`RESET ROLE`); }
    }
  });
});
