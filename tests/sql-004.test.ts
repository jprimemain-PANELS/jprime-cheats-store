import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { buildLiveDb, readSql, OWNER } from "./helpers/pg-live";

let db: PGlite;
const q = async (sql: string, p?: any[]) => (await db.query<any>(sql, p)).rows;

beforeAll(async () => {
  db = await buildLiveDb();
  await db.exec(`INSERT INTO public.users (id, username, password, role) VALUES ('boss','boss','x','admin');`);
  await db.exec(readSql("001_TENANT_FOUNDATION.sql"));
  await db.exec(readSql("003_COADMIN_FUNCTIONS.sql"));
});

describe("004 custom domains", () => {
  it("is additive: owner rows unchanged, new columns have safe defaults, re-runnable", async () => {
    const before = await q(`SELECT host, tenant_id, verified FROM public.tenant_domains ORDER BY host`);
    await db.exec(readSql("004_CUSTOM_DOMAINS.sql"));
    await db.exec(readSql("004_CUSTOM_DOMAINS.sql"));
    const after = await q(`SELECT host, tenant_id, verified, kind, dns_verified FROM public.tenant_domains ORDER BY host`);
    expect(after.map(({ host, tenant_id, verified }) => ({ host, tenant_id, verified }))).toEqual(before);
    expect(after.every((r) => r.kind === "subdomain" && r.dns_verified === false)).toBe(true);
    expect((await q(`SELECT custom_domain_allowed FROM public.tenants WHERE id=$1`, [OWNER]))[0].custom_domain_allowed).toBe(false);
  });
  it("allows one custom domain per store, rejects duplicates and bad kinds", async () => {
    await db.exec(`INSERT INTO public.tenants (id, slug, kind, status, brand_name) VALUES ('00000000-0000-0000-0000-0000000000b2','bbb','coadmin','active','B')`);
    const ins = (h: string, kind = "custom") => db.query(`INSERT INTO public.tenant_domains (host, tenant_id, kind) VALUES ($1,'00000000-0000-0000-0000-0000000000b2',$2)`, [h, kind]);
    await ins("a.example.com");
    await expect(ins("b.example.com")).rejects.toThrow();
    await expect(ins("c.example.com", "weird")).rejects.toThrow();
    await expect(ins("a.example.com", "subdomain")).rejects.toThrow();
  });
  it("rollback restores the original shape", async () => {
    await db.exec(`DELETE FROM public.tenant_domains WHERE kind='custom'`);
    await db.exec(readSql("004_ROLLBACK.sql"));
    const cols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_name='tenant_domains'`)).map((r) => r.column_name);
    expect(cols).not.toContain("kind");
    expect((await q(`SELECT count(*)::int n FROM public.tenant_domains WHERE tenant_id=$1 AND verified`, [OWNER]))[0].n).toBeGreaterThanOrEqual(2);
  });
});
