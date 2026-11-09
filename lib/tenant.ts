import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Trusted host -> tenant resolution (server only).
 * The tenant is NEVER taken from the request body, query string or any custom header:
 * only from the Host the platform delivered, mapped through public.tenant_domains.
 */
import { OWNER_TENANT_ID } from "@/lib/tenant-db";
export { OWNER_TENANT_ID };

export type TenantStatus = "pending" | "active" | "suspended" | "rejected";

export type Tenant = {
  id: string;
  slug: string;
  kind: "owner" | "coadmin";
  status: TenantStatus;
  brandName: string;
  inventoryMode: "own_api" | "shared_stock";
  sharedStockAllowed: boolean;
  telegramUsername: string | null;
  planExpiresAt: string | null;       // null = never expires
  subscriptionExpired: boolean;       // status is shown as "suspended" while true (no new purchases)
};

const OWNER_TENANT: Tenant = {
  id: OWNER_TENANT_ID,
  slug: "jprime",
  kind: "owner",
  status: "active",
  brandName: "JPRIME STORE",
  inventoryMode: "own_api",
  sharedStockAllowed: true,
  telegramUsername: null,
  planExpiresAt: null,
  subscriptionExpired: false,
};

const BUILTIN_OWNER_HOSTS = ["jprimecheats.store", "www.jprimecheats.store"];

export function normalizeHost(raw: string | null | undefined): string {
  return String(raw ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

function ownerHosts(): Set<string> {
  const extra = String(process.env.OWNER_EXTRA_HOSTS ?? "")
    .split(",")
    .map(normalizeHost)
    .filter(Boolean);
  return new Set([...BUILTIN_OWNER_HOSTS, ...extra]);
}

/** Local dev and Vercel Preview deployments are the owner store unless mapped otherwise. */
function allowOwnerFallbackForUnknownHosts(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production") return false;
  if (vercelEnv === "preview" || vercelEnv === "development") return true;
  return process.env.NODE_ENV !== "production";
}

const TTL_MS = 10_000;
const cache = new Map<string, { at: number; tenant: Tenant | null }>();

export function clearTenantCache() {
  cache.clear();
}

function rowToTenant(row: any): Tenant {
  // A store whose plan ran out behaves like a suspended store (customers keep history, no new purchases).
  // NULL expiry (every store that exists today, and the owner) never expires.
  const exp = row.plan_expires_at ? new Date(row.plan_expires_at).getTime() : null;
  const expired = row.kind !== "owner" && exp !== null && exp < Date.now();
  return {
    planExpiresAt: row.plan_expires_at ? String(row.plan_expires_at) : null,
    subscriptionExpired: expired,
    id: String(row.id),
    slug: String(row.slug),
    kind: row.kind === "owner" ? "owner" : "coadmin",
    status: (expired && row.status === "active" ? "suspended" : row.status) as TenantStatus,
    brandName: String(row.brand_name ?? ""),
    inventoryMode: row.inventory_mode === "shared_stock" ? "shared_stock" : "own_api",
    sharedStockAllowed: row.shared_stock_allowed === true,
    telegramUsername: row.telegram_username ? String(row.telegram_username) : null,
  };
}

/**
 * Returns the tenant for a host, or null when the host is unknown or the tenant is
 * pending/rejected (those stores do not exist publicly). Suspended tenants DO resolve
 * so customers can still sign in and see history; use canTransact() before money moves.
 */
export async function resolveTenantByHost(rawHost: string | null | undefined): Promise<Tenant | null> {
  const host = normalizeHost(rawHost);
  if (!host) return null;

  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.tenant;

  let tenant: Tenant | null = null;
  let lookupFailed = false;
  let mapped = false;

  try {
    const { data: dom, error: domErr } = await supabaseAdmin
      .from("tenant_domains")
      .select("tenant_id, verified")
      .eq("host", host)
      .maybeSingle();

    if (domErr) {
      lookupFailed = true;
    } else if (dom) {
      mapped = true;
      if (dom.verified === true) {
        const { data: row, error: tErr } = await supabaseAdmin
          .from("tenants")
          .select("*")
          .eq("id", dom.tenant_id)
          .maybeSingle();
        if (tErr) lookupFailed = true;
        else if (row && (row.status === "active" || row.status === "suspended")) tenant = rowToTenant(row);
      }
    }
  } catch {
    lookupFailed = true;
  }

  // A host that IS mapped to a co-admin tenant never falls back to the owner store.
  if (!tenant && !mapped) {
    if (ownerHosts().has(host)) tenant = OWNER_TENANT; // owner hosts survive an unreachable/unmigrated DB
    else if (allowOwnerFallbackForUnknownHosts()) tenant = OWNER_TENANT; // local dev + Vercel Preview only
  }

  if (!lookupFailed) cache.set(host, { at: Date.now(), tenant });
  return tenant;
}

/** The tenant of the request currently being served (App Router server context). */
export async function currentTenant(): Promise<Tenant | null> {
  let h: Headers;
  try {
    h = await headers();
  } catch {
    return null;
  }
  return resolveTenantByHost(h.get("host") || h.get("x-forwarded-host"));
}

/** Money may move only for an ACTIVE tenant. Suspended stores keep history, accept nothing new. */
export function canTransact(tenant: Tenant | null): tenant is Tenant {
  return !!tenant && tenant.status === "active";
}

export const SUSPENDED_MESSAGE = "This store is temporarily unavailable for new purchases.";
