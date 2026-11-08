import { supabaseAdmin } from "@/lib/supabase-admin";

export const OWNER_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const OWNER_ID = OWNER_TENANT_ID;

/**
 * Tenant-scoped data access. This is the ONLY place application code may touch
 * tenant-owned tables. Every read/update/delete is filtered by tenant_id and every
 * insert/upsert is stamped with it (a tenant_id sent by a client is overwritten).
 * tests/static-guard.test.ts fails the build if any other file queries these tables.
 */
export const TENANT_TABLES = [
  "users",
  "wallets",
  "wallet_transactions",
  "deposit_history",
  "payment_orders",
  "purchase_history",
  "stock_keys",
  "product_prices",
  "products_catalog",
  "reseller_price_overrides",
] as const;

export type TenantTable = (typeof TENANT_TABLES)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

type CountOpts = { count?: "exact" | "planned" | "estimated"; head?: boolean };

export function tdb(tenantId: string) {
  if (!isUuid(tenantId)) throw new Error("tdb: invalid tenant id");

  const stamp = (rows: any) =>
    Array.isArray(rows)
      ? rows.map((r) => ({ ...r, tenant_id: tenantId }))
      : { ...rows, tenant_id: tenantId };

  return {
    tenantId,
    from(table: TenantTable) {
      if (!(TENANT_TABLES as readonly string[]).includes(table)) {
        throw new Error(`tdb: ${String(table)} is not a tenant table`);
      }
      const q: any = supabaseAdmin.from(table);
      return {
        select: (columns: string = "*", opts?: CountOpts): any =>
          q.select(columns, opts).eq("tenant_id", tenantId),
        insert: (rows: any): any => q.insert(stamp(rows)),
        upsert: (rows: any, opts?: { onConflict?: string; ignoreDuplicates?: boolean }): any =>
          q.upsert(stamp(rows), opts),
        update: (values: Record<string, unknown>): any => {
          const { tenant_id: _ignored, ...safe } = values as any;
          return q.update(safe).eq("tenant_id", tenantId);
        },
        delete: (): any => q.delete().eq("tenant_id", tenantId),
      };
    },
  };
}

/**
 * A UTR is a bank reference: it can settle ONE payment in total, whichever store it
 * was paid to. This is the only deliberately cross-tenant read, and it returns a boolean
 * only (never another tenant's row).
 */
export async function utrAlreadyUsed(utr: string, exceptGatewayOrderId: string): Promise<boolean> {
  for (const table of ["payment_orders", "deposit_history"] as const) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("gateway_order_id")
      .eq("utr", utr)
      .neq("gateway_order_id", exceptGatewayOrderId)
      .limit(1);
    if (!error && data && data.length > 0) return true;
  }
  return false;
}

/**
 * Per-store key/value settings (coupons, discounts) live in the existing app_settings table.
 * The OWNER store keeps its original keys untouched; every other store gets a private prefix,
 * so one store can never read or overwrite another store's settings.
 */
export function settingKey(tenantId: string, key: string): string {
  if (!isUuid(tenantId)) throw new Error("settingKey: invalid tenant id");
  return tenantId === OWNER_ID ? key : `t:${tenantId}:${key}`;
}
export async function readSetting(tenantId: string, key: string): Promise<{ data: any; error: any }> {
  return supabaseAdmin.from("app_settings").select("value").eq("key", settingKey(tenantId, key)).maybeSingle();
}
export async function writeSetting(tenantId: string, key: string, value: unknown): Promise<{ error: any }> {
  return supabaseAdmin
    .from("app_settings")
    .upsert({ key: settingKey(tenantId, key), value, updated_at: new Date().toISOString() }, { onConflict: "key" });
}
