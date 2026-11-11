import { supabaseAdmin } from "@/lib/supabase-admin";
import { hashPassword } from "@/lib/auth";
import { OWNER_TENANT_ID, clearTenantCache, type Tenant } from "@/lib/tenant";
import { DEFAULT_THEME, themeFromStored, validateTheme, type Theme } from "@/lib/theme";

/**
 * Co-admin (white-label store) management. Server only.
 * Touches ONLY platform tables (tenants, tenant_domains, tenant_applications, tenant_settings,
 * audit_log) and the SECURITY DEFINER helpers from 003_COADMIN_FUNCTIONS.sql; it never reads
 * tenant-owned business tables except through the counts RPC.
 * Callers MUST have passed requireAdmin (owner) / requireTenantAdmin / requireUser first.
 */

export const RESERVED_SLUGS = new Set([
  "www", "admin", "api", "app", "mail", "root", "support", "help", "billing", "status", "static", "assets",
  "cdn", "dev", "test", "staging", "preview", "login", "signup", "shop", "store", "jprime", "owner", "platform",
]);

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
export function slugProblem(slug: string): string | null {
  if (!SLUG_RE.test(slug) || slug.includes("--")) return "Use 3-32 lowercase letters, numbers or single hyphens.";
  if (RESERVED_SLUGS.has(slug)) return "That name is reserved.";
  if (/jprime/.test(slug)) return "That name is reserved.";
  return null;
}

/** Neutral parent domain for free subdomains. Must be configured by the owner (wildcard DNS + Vercel). */
export function platformRootDomain(): string | null {
  const d = String(process.env.PLATFORM_ROOT_DOMAIN ?? "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  return /^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/.test(d) ? d : null;
}
export const hostFor = (slug: string) => {
  const r = platformRootDomain();
  return r ? `${slug}.${r}` : null;
};

export async function checkSlug(slug: string): Promise<{ available: boolean; reason?: string }> {
  const s = String(slug ?? "").trim().toLowerCase();
  const p = slugProblem(s);
  if (p) return { available: false, reason: p };
  const [t, a] = await Promise.all([
    supabaseAdmin.from("tenants").select("id").eq("slug", s).limit(1),
    supabaseAdmin.from("tenant_applications").select("id").eq("slug", s).in("status", ["pending", "approved"]).limit(1),
  ]);
  if (t.error || a.error) return { available: false, reason: "Could not check right now. Try again." };
  if ((t.data?.length ?? 0) > 0 || (a.data?.length ?? 0) > 0) return { available: false, reason: "That name is already taken." };
  return { available: true };
}

/* ------------------------------ applications ------------------------------ */

export type ApplyInput = {
  brandName: string; slug: string; telegramUsername: string; inventoryMode: string;
  contactEmail: string; contactPhone: string; coadminUsername: string; coadminPassword: string;
};
export type Applicant = { id: string | number | null; tenantId: string; role: string };

const ELIGIBLE_ROLES = new Set(["reseller", "vip_reseller", "vip reseller", "vip"]);

export async function submitApplication(applicant: Applicant, tenant: Tenant, input: ApplyInput):
  Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  // Only a reseller of the store the request came from may apply; the applicant's tenant is forced server-side.
  if (!ELIGIBLE_ROLES.has(applicant.role) || applicant.tenantId !== tenant.id || tenant.status !== "active" || applicant.id == null) {
    return { ok: false, error: "Only resellers can apply.", status: 403 };
  }
  const brand = String(input.brandName ?? "").replace(/[\u0000-\u001f<>]/g, " ").trim();
  const slug = String(input.slug ?? "").trim().toLowerCase();
  const tg = String(input.telegramUsername ?? "").trim().replace(/^@/, "");
  const email = String(input.contactEmail ?? "").trim();
  const phone = String(input.contactPhone ?? "").trim();
  const uname = String(input.coadminUsername ?? "").trim();
  const pw = String(input.coadminPassword ?? "");
  const mode = input.inventoryMode === "shared_stock" ? "shared_stock" : "own_api";

  if (brand.length < 2 || brand.length > 40) return { ok: false, error: "Brand name must be 2-40 characters.", status: 400 };
  if (/jprime/i.test(brand) && tenant.kind === "owner") return { ok: false, error: "Please choose your own brand name.", status: 400 };
  const sp = slugProblem(slug);
  if (sp) return { ok: false, error: sp, status: 400 };
  if (!/^[A-Za-z0-9_]{4,32}$/.test(tg)) return { ok: false, error: "Enter a valid Telegram username.", status: 400 };
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(uname)) return { ok: false, error: "Admin username must be 3-32 letters, numbers, . _ -", status: 400 };
  if (pw.length < 8 || pw.length > 200) return { ok: false, error: "Admin password must be at least 8 characters.", status: 400 };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email.", status: 400 };
  if (phone.replace(/\D/g, "").length < 10 || phone.length > 20) return { ok: false, error: "Enter a valid phone number.", status: 400 };

  const mine = await supabaseAdmin.from("tenant_applications").select("id")
    .eq("applicant_user_id", String(applicant.id)).eq("applicant_tenant_id", tenant.id).in("status", ["pending", "approved"]).limit(1);
  if (mine.error) return { ok: false, error: "Could not submit right now.", status: 500 };
  if ((mine.data?.length ?? 0) > 0) return { ok: false, error: "You already have an application.", status: 409 };

  const free = await checkSlug(slug);
  if (!free.available) return { ok: false, error: free.reason || "That name is taken.", status: 409 };

  const { error } = await supabaseAdmin.from("tenant_applications").insert({
    applicant_user_id: String(applicant.id), applicant_tenant_id: tenant.id, brand_name: brand, slug,
    telegram_username: tg, inventory_mode: mode, contact_email: email || null, contact_phone: phone,
    coadmin_username: uname, coadmin_password_hash: hashPassword(pw), status: "pending",
  });
  if (error) {
    // unique index on open slugs makes a race lose cleanly
    return { ok: false, error: /duplicate|unique/i.test(error.message) ? "That name is already taken." : "Could not submit right now.", status: /duplicate|unique/i.test(error.message) ? 409 : 500 };
  }
  return { ok: true };
}

export async function myApplication(applicant: Applicant, tenant: Tenant) {
  if (applicant.id == null) return null;
  const { data } = await supabaseAdmin.from("tenant_applications")
    .select("id, brand_name, slug, status, review_note, created_at")
    .eq("applicant_user_id", String(applicant.id)).eq("applicant_tenant_id", tenant.id)
    .order("created_at", { ascending: false }).limit(1);
  const r: any = data?.[0];
  return r ? { id: r.id, brandName: r.brand_name, slug: r.slug, status: r.status, note: r.status === "rejected" ? r.review_note ?? "" : "", createdAt: r.created_at } : null;
}

/* --------------------------------- owner ---------------------------------- */

export async function ownerOverview() {
  const [apps, tenants, domains, stats] = await Promise.all([
    supabaseAdmin.from("tenant_applications").select("id, brand_name, slug, telegram_username, inventory_mode, contact_email, contact_phone, coadmin_username, status, created_at, review_note").order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("tenants").select("*").neq("kind", "owner").order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.from("tenant_domains").select("host, tenant_id, verified"),
    supabaseAdmin.rpc("jprime_tenant_stats"),
  ]);
  if (apps.error || tenants.error || domains.error) throw new Error("overview query failed");
  const st = new Map<string, any>(((stats.data as any[]) ?? []).map((r) => [r.tenant_id, r]));
  const dom = new Map<string, any[]>();
  for (const d of (domains.data as any[]) ?? []) dom.set(d.tenant_id, [...(dom.get(d.tenant_id) ?? []), d]);
  return {
    rootDomain: platformRootDomain(),
    applications: (apps.data as any[]).filter((a) => a.status === "pending").map((a) => ({
      id: a.id, brandName: a.brand_name, slug: a.slug, telegram: a.telegram_username, inventoryMode: a.inventory_mode,
      email: a.contact_email, phone: a.contact_phone, coadminUsername: a.coadmin_username, createdAt: a.created_at,
    })),
    stores: (tenants.data as any[]).filter((t) => !String(t.slug).startsWith("deleted-")).map((t) => {
      const s = st.get(t.id) ?? {};
      return {
        id: t.id, slug: t.slug, brandName: t.brand_name, status: t.status, banned: t.banned === true, inventoryMode: t.inventory_mode,
        sharedStockAllowed: t.shared_stock_allowed === true, telegram: t.telegram_username, createdAt: t.created_at,
        planExpiresAt: t.plan_expires_at ?? null, payer: t.payer_username ?? null,
        domains: (dom.get(t.id) ?? []).map((d) => ({ host: d.host, verified: d.verified === true })),
        customers: Number(s.customers ?? 0), resellers: Number(s.resellers ?? 0), products: Number(s.products ?? 0),
        orders: Number(s.orders ?? 0), walletTotal: Number(s.wallet_total ?? 0), lastPurchaseAt: s.last_purchase_at ?? null,
        // per-store gateway/supplier/platform wallet arrive in the next phases; never faked
        paymentStatus: "not_configured" as const,
      };
    }),
  };
}

type Actor = { id: string | number | null; username: string };
const actorArgs = (a: Actor) => ({ p_actor_id: String(a.id ?? ""), p_actor_name: a.username });

export async function approveApplication(id: string, actor: Actor) {
  const root = platformRootDomain();
  const { data, error } = await supabaseAdmin.rpc("jprime_approve_tenant_application", { p_app_id: id, ...actorArgs(actor), p_root_domain: root });
  clearTenantCache();
  if (error) return { ok: false as const, reason: "failed" };
  return { ...(data as any), domainConfigured: !!root };
}
export async function rejectApplication(id: string, note: string, actor: Actor) {
  const { data, error } = await supabaseAdmin.rpc("jprime_reject_tenant_application", { p_app_id: id, ...actorArgs(actor), p_note: String(note ?? "").slice(0, 300) });
  return error ? { ok: false as const, reason: "failed" } : (data as any);
}
export async function setStoreStatus(tenantId: string, status: string, reason: string, actor: Actor) {
  const { data, error } = await supabaseAdmin.rpc("jprime_set_tenant_status", { p_tenant: tenantId, p_status: status, ...actorArgs(actor), p_reason: String(reason ?? "").slice(0, 300) });
  clearTenantCache();
  return error ? { ok: false as const, reason: "failed" } : (data as any);
}
export async function createStoreDirect(i: { brandName: string; slug: string; telegram: string; inventoryMode: string; username: string; password: string; email?: string; phone?: string }, actor: Actor) {
  const sp = slugProblem(i.slug);
  if (sp) return { ok: false as const, reason: sp };
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(i.username)) return { ok: false as const, reason: "Invalid admin username." };
  if (String(i.password ?? "").length < 8) return { ok: false as const, reason: "Password must be at least 8 characters." };
  const { data, error } = await supabaseAdmin.rpc("jprime_create_tenant_direct", {
    p_brand: String(i.brandName).trim().slice(0, 40), p_slug: i.slug, p_telegram: String(i.telegram ?? "").replace(/^@/, ""),
    p_inventory: i.inventoryMode === "shared_stock" ? "shared_stock" : "own_api", p_username: i.username, p_password_hash: hashPassword(i.password),
    p_email: i.email ?? "", p_phone: i.phone ?? "", ...actorArgs(actor), p_root_domain: platformRootDomain(),
  });
  clearTenantCache();
  return error ? { ok: false as const, reason: "Could not create the store." } : (data as any);
}
export async function setSharedStockAllowed(tenantId: string, allowed: boolean, actor: Actor) {
  if (tenantId === OWNER_TENANT_ID) return { ok: false as const, reason: "owner_protected" };
  const { error } = await supabaseAdmin.from("tenants").update({ shared_stock_allowed: allowed, updated_at: new Date().toISOString() }).eq("id", tenantId).eq("kind", "coadmin");
  if (error) return { ok: false as const, reason: "failed" };
  await supabaseAdmin.from("audit_log").insert({ tenant_id: tenantId, actor_user_id: String(actor.id ?? ""), actor_username: actor.username, action: allowed ? "tenant.shared_stock_on" : "tenant.shared_stock_off", target: tenantId });
  clearTenantCache();
  return { ok: true as const };
}

/* -------------------------------- branding -------------------------------- */

export type PublicBrand = {
  name: string; slug: string; kind: "owner" | "coadmin"; telegram: string | null; theme: Theme | null;
};

/** null = the store never customised anything (the owner store keeps its original look untouched). */
export async function getTheme(tenantId: string): Promise<Theme | null> {
  const { data } = await supabaseAdmin.from("tenant_settings").select("theme").eq("tenant_id", tenantId).maybeSingle();
  const stored: any = (data as any)?.theme;
  return stored && Object.keys(stored).length ? themeFromStored(stored) : null;
}

export async function publicBrand(tenant: Tenant): Promise<PublicBrand> {
  return { name: tenant.brandName, slug: tenant.slug, kind: tenant.kind, telegram: tenant.telegramUsername, theme: await getTheme(tenant.id) };
}

/** A store admin edits ONLY their own store (tenant comes from the verified session/host, never the body). */
export async function saveBranding(tenant: Tenant, actor: Actor, input: any):
  Promise<{ ok: true; theme: Theme } | { ok: false; error: string }> {
  const current = (await getTheme(tenant.id)) ?? DEFAULT_THEME;
  const r = validateTheme(input?.theme, current);
  if (!r.ok) return r;

  let brand = tenant.brandName;
  if (input?.brandName !== undefined) {
    brand = String(input.brandName).replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim();
    if (brand.length < 2 || brand.length > 40) return { ok: false, error: "Brand name must be 2-40 characters." };
    if (tenant.kind === "coadmin" && /jprime/i.test(brand)) return { ok: false, error: "Please choose your own brand name." };
  }
  let tg = tenant.telegramUsername;
  if (input?.telegram !== undefined && tenant.kind === "coadmin") {
    const v = String(input.telegram).trim().replace(/^@/, "");
    if (v && !/^[A-Za-z0-9_]{4,32}$/.test(v)) return { ok: false, error: "Enter a valid Telegram username." };
    tg = v || null;
  }
  const up = await supabaseAdmin.from("tenant_settings").upsert({ tenant_id: tenant.id, theme: r.theme, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
  if (up.error) return { ok: false, error: "Could not save." };
  if (tenant.kind === "coadmin") {
    const t = await supabaseAdmin.from("tenants").update({ brand_name: brand, telegram_username: tg, updated_at: new Date().toISOString() }).eq("id", tenant.id);
    if (t.error) return { ok: false, error: "Could not save." };
  }
  await supabaseAdmin.from("audit_log").insert({ tenant_id: tenant.id, actor_user_id: String(actor.id ?? ""), actor_username: actor.username, action: "tenant.branding", target: tenant.id });
  clearTenantCache();
  return { ok: true, theme: r.theme };
}

/** Owner links the wallet (a user on the MAIN store) that pays for a store's JPRIME API stock and plan. */
export async function setStorePayer(tenantId: string, username: string, actor: { id: string | number | null; username: string }) {
  const u = String(username ?? "").trim();
  if (!u || u.length > 64) return { ok: false as const, reason: "Enter the reseller username (on the main store)." };
  const user = await supabaseAdmin.from("users").select("id, role").eq("tenant_id", OWNER_TENANT_ID).eq("username", u).maybeSingle();
  if (user.error || !user.data) return { ok: false as const, reason: "No such reseller on the main store (use the store owner's account from jprimecheats.store, not the store admin)." };
  if (["admin", "coadmin"].includes(String((user.data as any).role).toLowerCase())) return { ok: false as const, reason: "Pick a reseller or customer account, not an admin." };
  const r = await supabaseAdmin.from("tenants").update({ payer_username: u, updated_at: new Date().toISOString() }).eq("id", tenantId).eq("kind", "coadmin");
  if (r.error) return { ok: false as const, reason: /payer_username|column/i.test(r.error.message ?? "") ? "Run supabase/tenant/005_SUBSCRIPTIONS.sql first." : "failed" };
  await supabaseAdmin.from("audit_log").insert({ tenant_id: tenantId, actor_user_id: String(actor.id ?? ""), actor_username: actor.username, action: "store.payer_set", target: u });
  return { ok: true as const };
}

