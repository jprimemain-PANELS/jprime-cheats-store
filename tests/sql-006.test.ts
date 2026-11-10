import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { buildLiveDb, readSql, OWNER } from "./helpers/pg-live";

let db: PGlite;
const q = async (sql: string, p?: any[]) => (await db.query<any>(sql, p)).rows;
let T: string;
const ins = (o: Record<string, any>) => {
  const row: Record<string, any> = { tenant_id: T, kind: "other_seller", seller_name: "Some Seller", ...o };
  const k = Object.keys(row);
  return db.query(`INSERT INTO public.tenant_api_connections (${k.join(",")}) VALUES (${k.map((_, i) => `$${i + 1}`).join(",")})`, k.map((x) => row[x]));
};

beforeAll(async () => {
  db = await buildLiveDb();
  await db.exec(`INSERT INTO public.users (id, username, password, role) VALUES ('boss','boss','x','admin')`);
  await db.exec(readSql("001_TENANT_FOUNDATION.sql"));
  T = (await q(`INSERT INTO public.tenants (slug, kind, status, brand_name) VALUES ('rajhub','coadmin','active','Raj') RETURNING id`))[0].id;
});

describe("006 API system (real Postgres)", () => {
  it("is additive and re-runnable", async () => {
    await db.exec(readSql("006_API_SYSTEM.sql"));
    await db.exec(readSql("006_API_SYSTEM.sql"));
    expect((await q(`SELECT 1 FROM public.tenants WHERE id=$1`, [OWNER])).length).toBe(1);
    expect((await q(`SELECT 1 FROM public.tenant_api_connections`)).length).toBe(0);
  });
  it("enforces size and value limits", async () => {
    await expect(ins({ seller_name: "x" })).rejects.toThrow();
    await expect(ins({ kind: "bogus" })).rejects.toThrow();
    await expect(ins({ status: "bogus" })).rejects.toThrow();
    await expect(ins({ assigned_seller: "SELLER3" })).rejects.toThrow();
    await expect(ins({ api_key: "k".repeat(501) })).rejects.toThrow();
    await expect(ins({ notes: "n".repeat(8001) })).rejects.toThrow();
    await ins({ notes: "n".repeat(8000), api_key: "k".repeat(500) });
  });
  it("one APPROVED connection per seller per store (pending ones can repeat)", async () => {
    await ins({ status: "approved", assigned_seller: "SELLER1" });
    await expect(ins({ status: "approved", assigned_seller: "SELLER1" })).rejects.toThrow();
    await ins({ status: "approved", assigned_seller: "SELLER2" });
    await ins({ status: "pending" }); await ins({ status: "rejected", assigned_seller: "SELLER1" });
  });
  it("is private to the service role and removed with its store", async () => {
    const g = await q(`SELECT grantee FROM information_schema.role_table_grants WHERE table_name='tenant_api_connections'`);
    expect(g.map((r) => r.grantee)).not.toContain("anon");
    expect(g.map((r) => r.grantee)).not.toContain("authenticated");
    await db.exec(`DELETE FROM public.tenants WHERE id='${T}'`);
    expect((await q(`SELECT 1 FROM public.tenant_api_connections`)).length).toBe(0);
  });
  it("rollback removes only the new table", async () => {
    await db.exec(readSql("006_ROLLBACK.sql"));
    expect((await q(`SELECT to_regclass('public.tenant_api_connections') t`))[0].t).toBeNull();
    expect((await q(`SELECT 1 FROM public.tenants WHERE id=$1`, [OWNER])).length).toBe(1);
  });
});
