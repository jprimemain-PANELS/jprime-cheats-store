/**
 * In-memory stand-in for the Supabase service-role client, used by route-level tests.
 * It proves OUR code adds tenant filters / stamps tenant_id; it is NOT a substitute for
 * the real database (the SQL functions are tested separately against real Postgres).
 */
import { randomUUID } from "node:crypto";

type Row = Record<string, any>;
export const tables: Record<string, Row[]> = {};
export const rpcCalls: Array<{ name: string; args: any }> = [];

export function resetDb() {
  for (const k of Object.keys(tables)) delete tables[k];
  rpcCalls.length = 0;
}
export function seed(table: string, rows: Row[]) {
  tables[table] = [...(tables[table] ?? []), ...rows.map((r) => ({ id: randomUUID(), ...r }))];
}
const rows = (t: string) => (tables[t] ??= []);

class Query implements PromiseLike<any> {
  private mode: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private filters: Array<(r: Row) => boolean> = [];
  private payload: any;
  private lim?: number;
  private off?: number;
  private ord?: { col: string; asc: boolean };
  private opts: any;
  private returning = false;
  private singleMode: null | "maybe" | "one" = null;
  private conflict?: string[];

  constructor(private table: string) {}

  select(_cols?: string, opts?: any) {
    if (this.mode !== "select") this.returning = true;
    this.opts = opts;
    return this;
  }
  insert(p: any) { this.mode = "insert"; this.payload = p; return this; }
  update(p: any) { this.mode = "update"; this.payload = p; return this; }
  delete() { this.mode = "delete"; return this; }
  upsert(p: any, o?: any) {
    this.mode = "upsert"; this.payload = p;
    this.conflict = o?.onConflict ? String(o.onConflict).split(",").map((s: string) => s.trim()) : undefined;
    return this;
  }
  eq(c: string, v: any) { this.filters.push((r) => r[c] === v || (v !== null && String(r[c]) === String(v) && typeof v !== "boolean")); return this; }
  neq(c: string, v: any) { this.filters.push((r) => r[c] !== v); return this; }
  in(c: string, vs: any[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  gte(c: string, v: any) { this.filters.push((r) => String(r[c]) >= String(v)); return this; }
  or(expr: string) {
    // supports: "col.is.null,col.not.ilike.Prefix%"
    const parts = expr.split(",");
    this.filters.push((r) =>
      parts.some((p) => {
        const m1 = p.match(/^(\w+)\.is\.null$/);
        if (m1) return r[m1[1]] == null;
        const m2 = p.match(/^(\w+)\.not\.ilike\.(.*)%$/);
        if (m2) return !String(r[m2[1]] ?? "").toLowerCase().startsWith(m2[2].toLowerCase());
        return false;
      })
    );
    return this;
  }
  order(col: string, o?: { ascending?: boolean }) { this.ord = { col, asc: o?.ascending !== false }; return this; }
  limit(n: number) { this.lim = n; return this; }
  range(from: number, to: number) { this.off = from; this.lim = to - from + 1; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }
  single() { this.singleMode = "one"; return this; }

  private run() {
    const all = rows(this.table);
    const match = (r: Row) => this.filters.every((f) => f(r));
    let out: Row[] = [];
    if (this.mode === "insert") {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r: Row) => ({ id: randomUUID(), ...r }));
      all.push(...list);
      out = list;
    } else if (this.mode === "update") {
      out = all.filter(match);
      out.forEach((r) => Object.assign(r, this.payload));
    } else if (this.mode === "delete") {
      out = all.filter(match);
      tables[this.table] = all.filter((r) => !match(r));
    } else if (this.mode === "upsert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const p of list) {
        const ex = this.conflict && all.find((r) => this.conflict!.every((c) => r[c] === p[c]));
        if (ex) { Object.assign(ex, p); out.push(ex); }
        else { const n = { id: randomUUID(), ...p }; all.push(n); out.push(n); }
      }
    } else {
      out = all.filter(match);
      if (this.ord) out = [...out].sort((a, b) => (a[this.ord!.col] > b[this.ord!.col] ? 1 : -1) * (this.ord!.asc ? 1 : -1));
      if (this.lim != null || this.off) out = out.slice(this.off ?? 0, this.lim != null ? (this.off ?? 0) + this.lim : undefined);
    }
    out = out.map((r) => ({ ...r }));
    if (this.mode !== "select" && !this.returning) return { data: null, error: null };
    if (this.opts?.count) return { data: this.opts.head ? null : out, count: out.length, error: null };
    if (this.singleMode) {
      if (out.length > 1) return { data: null, error: { message: "multiple rows returned", code: "PGRST116" } };
      if (!out.length && this.singleMode === "one") return { data: null, error: { message: "no rows", code: "PGRST116" } };
      return { data: out[0] ?? null, error: null };
    }
    return { data: out, error: null };
  }
  then<T1 = any, T2 = never>(res?: ((v: any) => T1 | PromiseLike<T1>) | null, rej?: ((e: any) => T2 | PromiseLike<T2>) | null) {
    return Promise.resolve(this.run()).then(res, rej);
  }
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
function wallet(t: string, u: string, create: boolean) {
  let w = rows("wallets").find((x) => x.tenant_id === t && x.username === u);
  if (!w && create) { w = { id: randomUUID(), tenant_id: t, username: u, balance: 0 }; rows("wallets").push(w); }
  return w;
}

export const supabaseAdmin = {
  from: (t: string) => new Query(t),
  rpc: async (name: string, args: any = {}) => {
    rpcCalls.push({ name, args });
    const { p_tenant: t, p_username: u, p_amount: a } = args;
    if (name === "jprime_t_wallet_get_balance") return { data: wallet(t, u, false)?.balance ?? 0, error: null };
    if (name === "jprime_t_wallet_get_or_create_balance") return { data: wallet(t, u, true)!.balance, error: null };
    if (name === "jprime_t_wallet_credit") {
      const w = wallet(t, u, true)!; w.balance = r2(Number(w.balance) + a);
      return { data: { ok: true, balance: w.balance }, error: null };
    }
    if (name === "jprime_t_wallet_debit") {
      const w = wallet(t, u, false);
      const cur = Number(w?.balance ?? 0);
      if (!w || cur < a) return { data: { ok: false, reason: "insufficient", balance: cur }, error: null };
      w.balance = r2(cur - a);
      return { data: { ok: true, balance: w.balance }, error: null };
    }
    if (name === "jprime_tenant_stats") return { data: [], error: null };
    if (name.startsWith("jprime_approve_tenant_application") || name === "jprime_reject_tenant_application" || name === "jprime_set_tenant_status" || name === "jprime_create_tenant_direct") {
      return { data: { ok: true }, error: null };
    }
    return { data: null, error: { message: `unknown rpc ${name}` } };
  },
};
