import { randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { OWNER_TENANT_ID, clearTenantCache, normalizeHost, type Tenant } from "@/lib/tenant";
import { platformRootDomain } from "@/lib/tenant-admin";

/**
 * Custom domains for big co-admin stores. Server only.
 * Flow: owner allows it for a store -> co-admin types a domain, gets a TXT proof token ->
 * server checks DNS -> OWNER activates (adds the domain in Vercel, then flips verified=true).
 * Until verified=true the domain serves nothing, so a typed domain can never hijack anything.
 * Needs supabase/tenant/004_CUSTOM_DOMAINS.sql; before that it reports "needs_sql" and does nothing.
 */

export const TXT_PREFIX = "_store-verify";
export const VERCEL_A = "76.76.21.21";
export const VERCEL_CNAME = "cname.vercel-dns.com";
const STALE_UNVERIFIED_MS = 3 * 24 * 3600 * 1000;

type Actor = { id: string | number | null; username: string };
const BLOCKED_SUFFIXES = ["vercel.app", "vercel.com", "vercel.sh", "now.sh", "localhost", "local", "internal", "supabase.co", "supabase.com"];

function ownerHostSet(): Set<string> {
  const extra = String(process.env.OWNER_EXTRA_HOSTS ?? "").split(",").map(normalizeHost).filter(Boolean);
  return new Set(["jprimecheats.store", "www.jprimecheats.store", ...extra]);
}

/** Returns the clean host, or an error message. Accepts "shop.example.com" (not URLs, ports, IPs, wildcards). */
export function parseCustomDomain(input: unknown): { host: string } | { error: string } {
  let h = String(input ?? "").trim().toLowerCase();
  if (!h) return { error: "Enter your domain, for example shop.yourname.com" };
  if (/[\s/@:?#*_]/.test(h)) return { error: "Enter only the domain name, like shop.yourname.com (no https://, paths or wildcards)." };
  h = h.replace(/\.$/, "");
  if (h.length > 253 || !/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(h)) return { error: "That does not look like a valid domain name." };
  if (/^\d+(\.\d+){3}$/.test(h)) return { error: "IP addresses are not allowed." };
  if (h.split(".").some((l) => l.startsWith("xn--"))) return { error: "Internationalised (xn--) domains are not supported yet." };
  const root = platformRootDomain();
  const all = [...ownerHostSet(), ...(root ? [root] : [])];
  for (const o of all) if (h === o || h.endsWith("." + o)) return { error: "That domain belongs to the platform and cannot be used." };
  for (const s of BLOCKED_SUFFIXES) if (h === s || h.endsWith("." + s)) return { error: "That domain cannot be used." };
  return { host: h };
}

const needsSql = (e: any) => !!e && /column|does not exist|schema cache|kind|custom_domain_allowed/i.test(String(e.message ?? e));

export type DomainState = {
  available: boolean; // 004 applied
  allowed: boolean;   // owner enabled custom domains for this store
  subdomain: string | null;
  custom: null | {
    host: string; status: "waiting_dns" | "waiting_owner" | "live";
    txtName: string; txtValue: string; aRecord: string; cname: string;
    lastCheckAt: string | null; note: string | null;
  };
};

export async function domainState(tenantId: string): Promise<DomainState> {
  const t = await supabaseAdmin.from("tenants").select("custom_domain_allowed").eq("id", tenantId).maybeSingle();
  if (t.error) return { available: false, allowed: false, subdomain: null, custom: null };
  const d = await supabaseAdmin.from("tenant_domains").select("host, verified, kind, dns_verified, verify_token, last_check_at, last_check_note").eq("tenant_id", tenantId);
  if (d.error) return { available: false, allowed: false, subdomain: null, custom: null };
  const rows = (d.data as any[]) ?? [];
  const sub = rows.find((r) => r.kind !== "custom" && r.verified === true);
  const c = rows.find((r) => r.kind === "custom");
  return {
    available: true,
    allowed: (t.data as any)?.custom_domain_allowed === true,
    subdomain: sub?.host ?? null,
    custom: c ? {
      host: c.host,
      status: c.verified === true ? "live" : c.dns_verified === true ? "waiting_owner" : "waiting_dns",
      txtName: `${TXT_PREFIX}.${c.host}`, txtValue: String(c.verify_token ?? ""), aRecord: VERCEL_A, cname: VERCEL_CNAME,
      lastCheckAt: c.last_check_at ?? null, note: c.last_check_note ?? null,
    } : null,
  };
}

async function audit(tenantId: string, actor: Actor, action: string, target: string) {
  await supabaseAdmin.from("audit_log").insert({ tenant_id: tenantId, actor_user_id: String(actor.id ?? ""), actor_username: actor.username, action, target });
}

export async function requestCustomDomain(tenant: Tenant, actor: Actor, input: unknown) {
  if (tenant.kind !== "coadmin") return { ok: false as const, error: "Only co-admin stores use custom domains." };
  if (tenant.status !== "active") return { ok: false as const, error: "Your store is not active." };
  const p = parseCustomDomain(input);
  if ("error" in p) return { ok: false as const, error: p.error };
  const st = await domainState(tenant.id);
  if (!st.available) return { ok: false as const, error: "Custom domains are not enabled on the platform yet." };
  if (!st.allowed) return { ok: false as const, error: "Custom domains are not enabled for your store. Ask the platform owner." };
  if (st.custom?.status === "live") return { ok: false as const, error: "Remove your current custom domain first." };

  const ex = await supabaseAdmin.from("tenant_domains").select("host, tenant_id, verified, kind, requested_at").eq("host", p.host).maybeSingle();
  if (ex.error) return { ok: false as const, error: "Could not check right now." };
  const row: any = ex.data;
  if (row && row.kind !== "custom") return { ok: false as const, error: "That domain is already in use." };
  if (row && row.tenant_id !== tenant.id) {
    const stale = row.kind === "custom" && row.verified !== true && row.requested_at && Date.now() - new Date(row.requested_at).getTime() > STALE_UNVERIFIED_MS;
    if (!stale) return { ok: false as const, error: "That domain is already in use." };
    await supabaseAdmin.from("tenant_domains").delete().eq("host", p.host).eq("verified", false).eq("kind", "custom");
  }
  // replace this store's own pending custom request
  await supabaseAdmin.from("tenant_domains").delete().eq("tenant_id", tenant.id).eq("kind", "custom").eq("verified", false);

  const token = "store-verify-" + randomBytes(16).toString("hex");
  const ins = await supabaseAdmin.from("tenant_domains").insert({
    host: p.host, tenant_id: tenant.id, is_primary: false, verified: false, kind: "custom", dns_verified: false,
    verify_token: token, requested_at: new Date().toISOString(),
  });
  if (ins.error) return { ok: false as const, error: needsSql(ins.error) ? "Custom domains are not enabled on the platform yet." : "That domain is already in use." };
  await audit(tenant.id, actor, "domain.requested", p.host);
  return { ok: true as const, state: await domainState(tenant.id) };
}

async function txtMatches(host: string, token: string): Promise<boolean> {
  try {
    const recs = await dns.resolveTxt(`${TXT_PREFIX}.${host}`);
    return recs.some((parts) => parts.join("").trim() === token);
  } catch { return false; }
}
async function pointsToVercel(host: string): Promise<boolean> {
  try { if ((await dns.resolve4(host)).includes(VERCEL_A)) return true; } catch {}
  try { if ((await dns.resolveCname(host)).some((c) => /vercel-dns\.com\.?$/i.test(c))) return true; } catch {}
  return false;
}

/** Co-admin presses "Check DNS". Marks dns_verified only; it never makes the domain live. */
export async function checkCustomDomainDns(tenant: Tenant, actor: Actor) {
  const st = await domainState(tenant.id);
  if (!st.available || !st.custom) return { ok: false as const, error: "No custom domain requested." };
  const c = st.custom;
  const [txt, points] = await Promise.all([txtMatches(c.host, c.txtValue), pointsToVercel(c.host)]);
  const note = txt ? (points ? "DNS proof found and the domain points to our host." : "Proof found. The domain does not point to our host yet (this is fine until you are ready to go live).")
    : "We could not find the proof record yet. DNS can take a few minutes up to a few hours.";
  await supabaseAdmin.from("tenant_domains").update({ dns_verified: txt, last_check_at: new Date().toISOString(), last_check_note: note }).eq("host", c.host).eq("tenant_id", tenant.id).eq("kind", "custom");
  await audit(tenant.id, actor, txt ? "domain.dns_ok" : "domain.dns_pending", c.host);
  return { ok: true as const, proofFound: txt, pointsToHost: points, note, state: await domainState(tenant.id) };
}

export async function removeCustomDomain(tenant: Tenant, actor: Actor) {
  const st = await domainState(tenant.id);
  if (!st.available || !st.custom) return { ok: false as const, error: "No custom domain to remove." };
  const host = st.custom.host;
  await supabaseAdmin.from("tenant_domains").delete().eq("host", host).eq("tenant_id", tenant.id).eq("kind", "custom");
  await vercelDomain("DELETE", host).catch(() => null);
  clearTenantCache();
  await audit(tenant.id, actor, "domain.removed", host);
  return { ok: true as const, state: await domainState(tenant.id) };
}

/* -------------------------------- owner side -------------------------------- */

export async function setCustomDomainAllowed(tenantId: string, allowed: boolean, actor: Actor) {
  if (tenantId === OWNER_TENANT_ID) return { ok: false as const, reason: "owner_protected" };
  const r = await supabaseAdmin.from("tenants").update({ custom_domain_allowed: allowed }).eq("id", tenantId).eq("kind", "coadmin");
  if (r.error) return { ok: false as const, reason: needsSql(r.error) ? "Run supabase/tenant/004_CUSTOM_DOMAINS.sql first." : "failed" };
  await audit(tenantId, actor, allowed ? "domain.allowed" : "domain.disallowed", tenantId);
  return { ok: true as const };
}

/** Optional automation: only runs when VERCEL_TOKEN + VERCEL_PROJECT_ID are set. */
export function vercelConfigured() { return !!(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID); }
async function vercelDomain(method: "POST" | "DELETE", host: string): Promise<{ ok: boolean; error?: string }> {
  if (!vercelConfigured()) return { ok: false, error: "not_configured" };
  const team = process.env.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : "";
  const base = `https://api.vercel.com/v10/projects/${encodeURIComponent(process.env.VERCEL_PROJECT_ID!)}/domains`;
  const url = method === "POST" ? base + team : `${base}/${encodeURIComponent(host)}${team}`;
  const res = await fetch(url, {
    method, headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify({ name: host }) : undefined, cache: "no-store",
  });
  if (res.ok) return { ok: true };
  const j: any = await res.json().catch(() => ({}));
  return { ok: false, error: String(j?.error?.message ?? `Vercel returned ${res.status}`).slice(0, 200) };
}

/**
 * Owner activates a store's custom domain. Requires proven DNS. If the Vercel API is configured we add
 * the domain automatically; otherwise the owner confirms they added it in the Vercel dashboard.
 */
export async function activateCustomDomain(host: string, addedInVercelManually: boolean, actor: Actor) {
  const h = parseCustomDomain(host);
  if ("error" in h) return { ok: false as const, reason: h.error };
  const r = await supabaseAdmin.from("tenant_domains").select("host, tenant_id, kind, dns_verified, verified").eq("host", h.host).eq("kind", "custom").maybeSingle();
  const row: any = r.data;
  if (r.error || !row) return { ok: false as const, reason: "Domain request not found." };
  if (row.tenant_id === OWNER_TENANT_ID) return { ok: false as const, reason: "owner_protected" };
  if (row.dns_verified !== true) return { ok: false as const, reason: "DNS proof has not been found yet. Ask the store to press Check DNS." };

  let via = "manual";
  if (vercelConfigured()) {
    const v = await vercelDomain("POST", h.host);
    if (!v.ok && !/already/i.test(v.error ?? "")) return { ok: false as const, reason: `Vercel refused the domain: ${v.error}` };
    via = "vercel_api";
  } else if (!addedInVercelManually) {
    return { ok: false as const, reason: "Add the domain in Vercel (Project > Settings > Domains) first, then confirm." };
  }
  const up = await supabaseAdmin.from("tenant_domains").update({ verified: true, activated_at: new Date().toISOString() }).eq("host", h.host).eq("kind", "custom");
  if (up.error) return { ok: false as const, reason: "failed" };
  clearTenantCache();
  await audit(row.tenant_id, actor, "domain.activated", `${h.host} (${via})`);
  return { ok: true as const, via };
}

export async function ownerRemoveCustomDomain(host: string, actor: Actor) {
  const h = parseCustomDomain(host);
  if ("error" in h) return { ok: false as const, reason: h.error };
  const r = await supabaseAdmin.from("tenant_domains").select("tenant_id").eq("host", h.host).eq("kind", "custom").maybeSingle();
  const row: any = r.data;
  if (!row) return { ok: false as const, reason: "Not found." };
  await supabaseAdmin.from("tenant_domains").delete().eq("host", h.host).eq("kind", "custom");
  await vercelDomain("DELETE", h.host).catch(() => null);
  clearTenantCache();
  await audit(row.tenant_id, actor, "domain.removed_by_owner", h.host);
  return { ok: true as const };
}

/** Owner overview extra: custom-domain rows + flags, tolerant when 004 has not been run. */
export async function ownerDomainInfo() {
  const [t, d] = await Promise.all([
    supabaseAdmin.from("tenants").select("id, custom_domain_allowed").neq("kind", "owner"),
    supabaseAdmin.from("tenant_domains").select("host, tenant_id, verified, kind, dns_verified, last_check_note").eq("kind", "custom"),
  ]);
  if (t.error || d.error) return { available: false as const, allowed: {} as Record<string, boolean>, custom: {} as Record<string, any>, vercelApi: vercelConfigured() };
  const allowed: Record<string, boolean> = {};
  for (const r of (t.data as any[]) ?? []) allowed[r.id] = r.custom_domain_allowed === true;
  const custom: Record<string, any> = {};
  for (const r of (d.data as any[]) ?? []) custom[r.tenant_id] = { host: r.host, live: r.verified === true, dnsOk: r.dns_verified === true, note: r.last_check_note ?? null };
  return { available: true as const, allowed, custom, vercelApi: vercelConfigured() };
}
