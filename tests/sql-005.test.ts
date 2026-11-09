import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { buildLiveDb, readSql, OWNER } from "./helpers/pg-live";

vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));
import { PLANS, TRIAL_DAYS } from "@/lib/subscription";

let db: PGlite;
const q = async (sql: string, p?: any[]) => (await db.query<any>(sql, p)).rows;
const one = async (sql: string, p?: any[]) => (await q(sql, p))[0];
const rpc = async (fn: string, ...a: any[]) => (await one(`SELECT public.${fn}(${a.map((_, i) => `$${i + 1}`).join(",")}) r`, a)).r;
let T: string, T2: string;
const bal = async (u: string) => Number((await one(`SELECT balance FROM public.wallets WHERE tenant_id=$1 AND username=$2`, [OWNER, u]))?.balance ?? 0);

beforeAll(async () => {
  db = await buildLiveDb();
  await db.exec(`INSERT INTO public.users (id, username, password, role) VALUES ('boss','boss','x','admin')`);
  await db.exec(readSql("001_TENANT_FOUNDATION.sql"));
  await db.exec(readSql("003_COADMIN_FUNCTIONS.sql"));
  T = (await one(`INSERT INTO public.tenants (slug, kind, status, brand_name) VALUES ('rajhub','coadmin','active','Raj') RETURNING id`)).id;
  T2 = (await one(`INSERT INTO public.tenants (slug, kind, status, brand_name) VALUES ('nopayer','coadmin','active','N') RETURNING id`)).id;
  await db.exec(`INSERT INTO public.wallets (id, username, balance, tenant_id) VALUES ('w1','resA',1000,'${OWNER}'),('w2','poor',50,'${OWNER}')`);
});

describe("005 subscriptions (real Postgres)", () => {
  it("is additive and re-runnable; nobody gets an expiry", async () => {
    await db.exec(readSql("005_SUBSCRIPTIONS.sql"));
    await db.exec(readSql("005_SUBSCRIPTIONS.sql"));
    expect((await q(`SELECT 1 FROM public.tenants WHERE plan_expires_at IS NOT NULL`)).length).toBe(0);
    expect((await one(`SELECT kind, status FROM public.tenants WHERE id=$1`, [OWNER]))).toMatchObject({ kind: "owner", status: "active" });
  });
  it("trial: once only, N days, links the payer wallet; bad input and the owner store are refused", async () => {
    expect(await rpc("jprime_tenant_start_trial", OWNER, "resA", 3)).toMatchObject({ ok: false });
    expect(await rpc("jprime_tenant_start_trial", T, "resA", 0)).toMatchObject({ ok: false, reason: "invalid" });
    expect(await rpc("jprime_tenant_start_trial", T, "", 3)).toMatchObject({ ok: false, reason: "invalid" });
    expect(await rpc("jprime_tenant_start_trial", T, "resA", TRIAL_DAYS)).toMatchObject({ ok: true });
    expect(await rpc("jprime_tenant_start_trial", T, "resA", TRIAL_DAYS)).toMatchObject({ ok: false, reason: "trial_used" });
    const t = await one(`SELECT payer_username, trial_used, EXTRACT(EPOCH FROM (plan_expires_at - now()))/86400 d FROM public.tenants WHERE id=$1`, [T]);
    expect(t).toMatchObject({ payer_username: "resA", trial_used: true });
    expect(Number(t.d)).toBeGreaterThan(2.99); expect(Number(t.d)).toBeLessThan(3.01);
  });
  it("buying a plan charges the wallet AND adds days AFTER the current days (nothing lost)", async () => {
    const before = await one(`SELECT plan_expires_at e FROM public.tenants WHERE id=$1`, [T]);
    const r = await rpc("jprime_tenant_subscribe", T, "monthly", "andrew");
    expect(r).toMatchObject({ ok: true, price: 249, balance: 751 });
    expect(await bal("resA")).toBe(751);
    const after = await one(`SELECT EXTRACT(EPOCH FROM (plan_expires_at - $1::timestamptz))/86400 d FROM public.tenants WHERE id=$2`, [before.e, T]);
    expect(Number(after.d)).toBeCloseTo(30, 3);
    expect((await one(`SELECT action, target, meta FROM public.audit_log WHERE action='sub.pay'`))).toMatchObject({ target: "monthly" });
  });
  it("prices and days in SQL equal what the pages show", async () => {
    await db.exec(`UPDATE public.wallets SET balance = 5000 WHERE id='w1'`);
    for (const [k, p] of Object.entries(PLANS)) {
      const before = await one(`SELECT plan_expires_at e FROM public.tenants WHERE id=$1`, [T]);
      const r = await rpc("jprime_tenant_subscribe", T, k, "andrew");
      expect(r.ok, k).toBe(true);
      expect(r.price, k).toBe(p.price);
      const d = await one(`SELECT EXTRACT(EPOCH FROM (plan_expires_at - $1::timestamptz))/86400 d FROM public.tenants WHERE id=$2`, [before.e, T]);
      expect(Math.round(Number(d.d)), k).toBe(p.days);
    }
    expect(PLANS.quarterly.price).toBe(Math.round(3 * PLANS.monthly.price * 0.93));
  });
  it("not enough money: NOTHING changes (no charge, no days, no audit row)", async () => {
    await db.exec(`UPDATE public.tenants SET payer_username='poor' WHERE id='${T2}'`);
    const e0 = await one(`SELECT plan_expires_at e FROM public.tenants WHERE id=$1`, [T2]);
    const audits = (await q(`SELECT 1 FROM public.audit_log WHERE action='sub.pay'`)).length;
    const r = await rpc("jprime_tenant_subscribe", T2, "weekly", "x");
    expect(r).toMatchObject({ ok: false, reason: "insufficient", balance: 50 });
    expect(await bal("poor")).toBe(50);
    expect((await one(`SELECT plan_expires_at e FROM public.tenants WHERE id=$1`, [T2])).e).toEqual(e0.e);
    expect((await q(`SELECT 1 FROM public.audit_log WHERE action='sub.pay'`)).length).toBe(audits);
  });
  it("expired store: new days start from NOW, not from the past", async () => {
    await db.exec(`UPDATE public.tenants SET plan_expires_at = now() - interval '10 days' WHERE id='${T}'`);
    const r = await rpc("jprime_tenant_subscribe", T, "weekly", "andrew");
    expect(r.ok).toBe(true);
    const d = await one(`SELECT EXTRACT(EPOCH FROM (plan_expires_at - now()))/86400 d FROM public.tenants WHERE id=$1`, [T]);
    expect(Number(d.d)).toBeGreaterThan(6.99); expect(Number(d.d)).toBeLessThan(7.01);
  });
  it("refuses: bad plan, owner store, unknown tenant, store without a payer wallet, rejected store", async () => {
    expect(await rpc("jprime_tenant_subscribe", T, "free", "a")).toMatchObject({ ok: false, reason: "bad_plan" });
    expect(await rpc("jprime_tenant_subscribe", T, "WEEKLY", "a")).toMatchObject({ ok: false, reason: "bad_plan" });
    expect(await rpc("jprime_tenant_subscribe", OWNER, "weekly", "a")).toMatchObject({ ok: false, reason: "not_found" });
    expect(await rpc("jprime_tenant_subscribe", "00000000-0000-0000-0000-0000000000ff", "weekly", "a")).toMatchObject({ ok: false });
    const T3 = (await one(`INSERT INTO public.tenants (slug, kind, status, brand_name) VALUES ('nopay2','coadmin','active','N') RETURNING id`)).id;
    expect(await rpc("jprime_tenant_subscribe", T3, "weekly", "a")).toMatchObject({ ok: false, reason: "no_payer" });
    await db.exec(`UPDATE public.tenants SET status='rejected', payer_username='resA' WHERE id='${T3}'`);
    expect(await rpc("jprime_tenant_subscribe", T3, "weekly", "a")).toMatchObject({ ok: false, reason: "not_active" });
  });
  it("browser roles cannot call the functions; rollback restores the shape", async () => {
    const g = await one(`SELECT has_function_privilege('anon','public.jprime_tenant_subscribe(uuid,text,text)','EXECUTE') a,
                                has_function_privilege('authenticated','public.jprime_tenant_start_trial(uuid,text,int)','EXECUTE') b,
                                has_function_privilege('service_role','public.jprime_tenant_subscribe(uuid,text,text)','EXECUTE') c`);
    expect(g).toMatchObject({ a: false, b: false, c: true });
    await db.exec(readSql("005_ROLLBACK.sql"));
    const cols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_name='tenants'`)).map((r) => r.column_name);
    expect(cols).not.toContain("plan_expires_at");
    expect((await one(`SELECT kind FROM public.tenants WHERE id=$1`, [OWNER])).kind).toBe("owner");
  });
});
