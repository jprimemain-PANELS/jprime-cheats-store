import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { buildLiveDb, readSql, OWNER } from "./helpers/pg-live";

vi.mock("@/lib/supabase-admin", async () => await import("./helpers/fake-supabase"));

let db: PGlite;
const q = async (sql: string, p?: any[]) => (await db.query<any>(sql, p)).rows;
const one = async (sql: string, p?: any[]) => (await q(sql, p))[0];
const rpc = async (fn: string, ...a: any[]) => (await one(`SELECT public.${fn}(${a.map((_, i) => `$${i + 1}`).join(",")}) r`, a)).r;
let PARENT: string, SUB: string, MAINSTORE: string;
const bal = async (tenant: string, u: string) => Number((await one(`SELECT balance FROM public.wallets WHERE tenant_id=$1 AND username=$2`, [tenant, u]))?.balance ?? 0);

beforeAll(async () => {
  db = await buildLiveDb();
  await db.exec(`INSERT INTO public.users (id, username, password, role) VALUES ('boss','boss','x','admin')`);
  await db.exec(readSql("001_TENANT_FOUNDATION.sql"));
  await db.exec(readSql("003_COADMIN_FUNCTIONS.sql"));
  await db.exec(readSql("005_SUBSCRIPTIONS.sql"));
  PARENT = (await one(`INSERT INTO public.tenants (slug, kind, status, brand_name) VALUES ('parent','coadmin','active','P') RETURNING id`)).id;
  SUB = (await one(`INSERT INTO public.tenants (slug, kind, status, brand_name, payer_username) VALUES ('subshop','coadmin','active','S','subres') RETURNING id`)).id;
  MAINSTORE = (await one(`INSERT INTO public.tenants (slug, kind, status, brand_name, payer_username) VALUES ('mainpaid','coadmin','active','M','mainres') RETURNING id`)).id;
  await db.exec(`INSERT INTO public.wallets (id, username, balance, tenant_id) VALUES ('w1','subres',500,'${PARENT}'),('w2','mainres',500,'${OWNER}'),('w3','subres',900,'${OWNER}')`);
});

describe("009 editable prices + sub-stores (real Postgres)", () => {
  it("is additive and re-runnable", async () => {
    await db.exec(readSql("009_PLAN_PRICES_AND_SUBSTORES.sql"));
    await db.exec(readSql("009_PLAN_PRICES_AND_SUBSTORES.sql"));
    expect((await q(`SELECT 1 FROM public.tenants WHERE parent_tenant_id IS NOT NULL`)).length).toBe(0);
  });
  it("store with no parent: charged on the MAIN wallet at the price the server passes", async () => {
    const r = await rpc("jprime_tenant_subscribe_v2", MAINSTORE, "monthly", "x", 199, 30);
    expect(r).toMatchObject({ ok: true, price: 199, balance: 301 });
    expect(await bal(OWNER, "mainres")).toBe(301);
  });
  it("sub-store: charged on the PARENT store's wallet, never the main wallet of the same username", async () => {
    await db.exec(`UPDATE public.tenants SET parent_tenant_id='${PARENT}' WHERE id='${SUB}'`);
    const r = await rpc("jprime_tenant_subscribe_v2", SUB, "weekly", "x", 60, 7);
    expect(r).toMatchObject({ ok: true, price: 60, balance: 440 });
    expect(await bal(PARENT, "subres")).toBe(440);
    expect(await bal(OWNER, "subres")).toBe(900);
    const d = await one(`SELECT EXTRACT(EPOCH FROM (plan_expires_at - now()))/86400 d FROM public.tenants WHERE id=$1`, [SUB]);
    expect(Number(d.d)).toBeGreaterThan(6.99); expect(Number(d.d)).toBeLessThan(7.01);
  });
  it("not enough money in the parent wallet: nothing changes", async () => {
    const before = await one(`SELECT plan_expires_at e FROM public.tenants WHERE id=$1`, [SUB]);
    const r = await rpc("jprime_tenant_subscribe_v2", SUB, "quarterly", "x", 5000, 90);
    expect(r).toMatchObject({ ok: false, reason: "insufficient" });
    expect(await bal(PARENT, "subres")).toBe(440);
    expect((await one(`SELECT plan_expires_at e FROM public.tenants WHERE id=$1`, [SUB])).e).toEqual(before.e);
  });
  it("refuses bad plan, absurd price/days, owner store", async () => {
    expect(await rpc("jprime_tenant_subscribe_v2", SUB, "yearly", "x", 10, 7)).toMatchObject({ ok: false, reason: "bad_plan" });
    expect(await rpc("jprime_tenant_subscribe_v2", SUB, "weekly", "x", 0, 7)).toMatchObject({ ok: false, reason: "bad_plan" });
    expect(await rpc("jprime_tenant_subscribe_v2", SUB, "weekly", "x", 10, 0)).toMatchObject({ ok: false, reason: "bad_plan" });
    expect(await rpc("jprime_tenant_subscribe_v2", OWNER, "weekly", "x", 10, 7)).toMatchObject({ ok: false, reason: "not_found" });
  });
  it("rollback removes the function and column; 005 function still works", async () => {
    await db.exec(readSql("009_ROLLBACK.sql"));
    expect((await q(`SELECT 1 FROM pg_proc WHERE proname='jprime_tenant_subscribe_v2'`)).length).toBe(0);
    expect((await q(`SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='parent_tenant_id'`)).length).toBe(0);
    expect(await rpc("jprime_tenant_subscribe", MAINSTORE, "weekly", "x")).toMatchObject({ ok: true, price: 90 });
  });
});
