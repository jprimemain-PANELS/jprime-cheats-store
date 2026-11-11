import { supabaseAdmin } from "@/lib/supabase-admin";
import { OWNER_TENANT_ID, clearTenantCache, type Tenant } from "@/lib/tenant";
import { checkSlug, platformRootDomain, slugProblem, submitApplication, approveApplication, setStoreStatus } from "@/lib/tenant-admin";
import { verifyPassword } from "@/lib/auth";
import { parseCustomDomain, requestCustomDomain, domainState } from "@/lib/domains";
import { getStoreOptions } from "@/lib/store-options";

/**
 * Store subscriptions + self-service launch. Server only.
 * Prices live in the database function (005_SUBSCRIPTIONS.sql) so a browser can never change them;
 * the numbers below are for DISPLAY and are checked against the SQL by a test.
 */
export const TRIAL_DAYS = 3;
export const PLANS = {
  weekly: { label: "Weekly", price: 90, days: 7, note: "" },
  monthly: { label: "Monthly", price: 249, days: 30, note: "" },
  quarterly: { label: "3 Months", price: 695, days: 90, note: "Save 7%" },
} as const;
export type PlanKey = keyof typeof PLANS;

type Actor = { id: string | number | null; username: string };

export type SubState = {
  available: boolean;           // 005 applied
  expiresAt: string | null;     // null = never expires (old / owner-made stores)
  expired: boolean;
  daysLeft: number | null;
  trialUsed: boolean;
  payer: string | null;
  walletBalance: number | null; // the reseller's wallet on the main store
};

export async function subscriptionState(tenantId: string): Promise<SubState> {
  const none: SubState = { available: false, expiresAt: null, expired: false, daysLeft: null, trialUsed: false, payer: null, walletBalance: null };
  const r = await supabaseAdmin.from("tenants").select("plan_expires_at, trial_used, payer_username").eq("id", tenantId).maybeSingle();
  if (r.error || !r.data) return none;
  const row: any = r.data;
  const exp = row.plan_expires_at ? new Date(row.plan_expires_at) : null;
  const ms = exp ? exp.getTime() - Date.now() : null;
  let bal: number | null = null;
  if (row.payer_username) {
    const b = await supabaseAdmin.rpc("jprime_t_wallet_get_balance", { p_tenant: OWNER_TENANT_ID, p_username: row.payer_username });
    if (!b.error) bal = Number(b.data ?? 0);
  }
  return {
    available: true, expiresAt: exp ? exp.toISOString() : null, expired: ms !== null && ms < 0,
    daysLeft: ms === null ? null : Math.max(0, Math.ceil(ms / 86_400_000)), trialUsed: row.trial_used === true,
    payer: row.payer_username ?? null, walletBalance: bal,
  };
}

/**
 * The store admin links THEIR OWN main-store reseller account (username + password are checked) so the
 * plan and JPRIME API stock are paid from that wallet. Nothing is stored except the username.
 */
/** Proves a main-website (owner tenant) account by password. Never trusts a bare username. */
export async function verifyMainAccount(username: string, password: string) {
  const u = String(username ?? "").trim();
  if (!u || !password || u.length > 64 || password.length > 200) return { ok: false as const, error: "Enter your main website username and password." };
  const r = await supabaseAdmin.from("users").select("id, role, password").eq("tenant_id", OWNER_TENANT_ID).eq("username", u).maybeSingle();
  const row: any = r.data;
  if (r.error || !row || !verifyPassword(password, String(row.password ?? ""))) return { ok: false as const, error: "Wrong username or password for the main website (jprimecheats.store)." };
  if (["admin", "coadmin"].includes(String(row.role).toLowerCase())) return { ok: false as const, error: "Use your reseller account from the main website, not an admin account." };
  return { ok: true as const, username: u };
}

export async function linkWalletAccount(tenant: Tenant, username: string, password: string, actor: Actor) {
  if (tenant.kind !== "coadmin") return { ok: false as const, error: "Only co-admin stores link a wallet." };
  // Once linked, a store admin cannot switch it (only the platform owner can) - stops moving to a cheaper/other account.
  const cur = await supabaseAdmin.from("tenants").select("payer_username").eq("id", tenant.id).maybeSingle();
  if ((cur.data as any)?.payer_username) return { ok: false as const, error: "Your wallet account is already linked and locked. Contact the platform owner to change it." };
  const v = await verifyMainAccount(username, password);
  if (!v.ok) return v;
  const u = v.username;
  const up = await supabaseAdmin.from("tenants").update({ payer_username: u, updated_at: new Date().toISOString() }).eq("id", tenant.id).eq("kind", "coadmin");
  if (up.error) return { ok: false as const, error: "Could not link right now. Try again." };
  await supabaseAdmin.from("audit_log").insert({ tenant_id: tenant.id, actor_user_id: String(actor.id ?? ""), actor_username: actor.username, action: "store.payer_self_link", target: u });
  clearTenantCache();
  return { ok: true as const };
}

export async function subscribe(tenant: Tenant, plan: string, actor: Actor) {
  if (!(plan in PLANS)) return { ok: false as const, error: "Choose a plan." };
  if (tenant.kind !== "coadmin") return { ok: false as const, error: "Only co-admin stores have a plan." };
  const { data, error } = await supabaseAdmin.rpc("jprime_tenant_subscribe", { p_tenant: tenant.id, p_plan: plan, p_actor: actor.username });
  clearTenantCache();
  if (error) return { ok: false as const, error: "Could not take payment right now. Try again." };
  const d: any = data;
  if (!d?.ok) {
    const msg = d?.reason === "insufficient"
      ? `Not enough wallet balance. You need Rs ${PLANS[plan as PlanKey].price} and have Rs ${Number(d.balance ?? 0)}. Add money to your wallet on the main website and try again.`
      : d?.reason === "no_payer" ? "This store has no payment wallet linked. Contact the platform owner."
      : d?.reason === "not_active" ? "This store is not active. Contact the platform owner."
      : "Payment failed.";
    return { ok: false as const, error: msg };
  }
  return { ok: true as const, expiresAt: String(d.expires_at), balance: Number(d.balance ?? 0) };
}

/* ------------------------------ self-service launch ------------------------------ */

export type LaunchOptions = {
  selfService: boolean;      // 005 applied AND a free-address root domain exists
  root: string | null;
  customDomain: boolean;     // 004 applied
  trialDays: number;
  plans: typeof PLANS;
};

export async function launchOptions(): Promise<LaunchOptions> {
  const root = platformRootDomain();
  const sub = await supabaseAdmin.from("tenants").select("plan_expires_at").limit(1);
  const dom = await supabaseAdmin.from("tenants").select("custom_domain_allowed").limit(1);
  return { selfService: !!root && !sub.error, root, customDomain: !dom.error, trialDays: TRIAL_DAYS, plans: PLANS };
}

export type LaunchInput = {
  brandName: string; slug: string; telegramUsername: string; contactEmail: string; contactPhone: string;
  coadminUsername: string; coadminPassword: string; domainChoice: "free" | "custom"; customDomain?: string;
  mainUsername?: string; mainPassword?: string;   // needed when launching from a co-admin store
};

/**
 * A reseller launches their own store with NO owner approval. Reuses the same validated application +
 * approve code path (so every rule and the one-store-per-reseller limit stays in one place).
 * If anything after creation fails, the new store is suspended (never left free forever).
 */
export async function launchStore(
  applicant: { id: string | number | null; tenantId: string; role: string; username: string }, tenant: Tenant, input: LaunchInput,
): Promise<{ ok: true; url: string; expiresAt: string; custom: any } | { ok: false; error: string; status: number }> {
  const opts = await launchOptions();
  if (!opts.selfService) return { ok: false, error: "Instant launch is not open yet. Please try again later.", status: 503 };
  // From a co-admin store: only if the owner allowed it, and the payer must be PROVEN main-website account.
  let payer = applicant.username;
  if (tenant.kind === "coadmin") {
    if (!(await getStoreOptions(tenant.id)).resellerLaunch) return { ok: false, error: "Launching a website is not available here.", status: 403 };
    const v = await verifyMainAccount(String(input.mainUsername ?? ""), String(input.mainPassword ?? ""));
    if (!v.ok) return { ok: false, error: v.error, status: 400 };
    payer = v.username;
  }
  const wantCustom = input.domainChoice === "custom";
  let customHost = "";
  if (wantCustom) {
    if (!opts.customDomain) return { ok: false, error: "Using your own domain is not available yet. Pick the free address.", status: 400 };
    const p = parseCustomDomain(input.customDomain);
    if ("error" in p) return { ok: false, error: p.error, status: 400 };
    customHost = p.host;
  }

  const sub = await submitApplication(applicant, tenant, {
    brandName: input.brandName, slug: input.slug, telegramUsername: input.telegramUsername, inventoryMode: "own_api",
    contactEmail: input.contactEmail, contactPhone: input.contactPhone, coadminUsername: input.coadminUsername, coadminPassword: input.coadminPassword,
  });
  if (!sub.ok) return sub;

  const app = await supabaseAdmin.from("tenant_applications").select("id").eq("applicant_user_id", String(applicant.id))
    .eq("applicant_tenant_id", tenant.id).eq("status", "pending").order("created_at", { ascending: false }).limit(1);
  const appId = (app.data as any[])?.[0]?.id;
  if (app.error || !appId) return { ok: false, error: "Could not create your store. Please try again.", status: 500 };

  const actor = { id: "self-service", username: applicant.username };
  const made: any = await approveApplication(appId, actor);
  if (!made?.ok || !made.tenant_id) return { ok: false, error: made?.reason === "slug_taken" ? "That name was just taken. Pick another." : "Could not create your store. Please try again.", status: 409 };

  const trial = await supabaseAdmin.rpc("jprime_tenant_start_trial", { p_tenant: made.tenant_id, p_payer: payer, p_days: TRIAL_DAYS });
  if (trial.error || !(trial.data as any)?.ok) {
    await setStoreStatus(made.tenant_id, "suspended", "self-service launch: trial setup failed", actor);
    return { ok: false, error: "Your store was created but could not be switched on. Contact support.", status: 500 };
  }

  let custom: any = null;
  if (wantCustom) {
    // the owner's "allowed" switch is turned on by the reseller's own choice at launch
    await supabaseAdmin.from("tenants").update({ custom_domain_allowed: true }).eq("id", made.tenant_id).eq("kind", "coadmin");
    const t: Tenant = { id: made.tenant_id, slug: input.slug, kind: "coadmin", status: "active", brandName: input.brandName, inventoryMode: "own_api", sharedStockAllowed: false, telegramUsername: input.telegramUsername.replace(/^@/, ""), planExpiresAt: null, subscriptionExpired: false, banned: false };
    const r = await requestCustomDomain(t, actor, customHost);
    custom = r.ok ? (await domainState(made.tenant_id)).custom : { error: r.error };
  }
  return { ok: true, url: `https://${made.host}`, expiresAt: String((trial.data as any).expires_at), custom };
}
