import { supabaseAdmin } from "@/lib/supabase-admin";
import { OWNER_TENANT_ID, tdb, readSetting, writeSetting } from "@/lib/tenant-db";

/**
 * Delete a customer/reseller account of ONE store. Server only.
 * Callers MUST have passed requireTenantAdmin; the tenant comes from the verified session/host.
 * Safe by design:
 *  - tenant-scoped (a store can never touch another store's users),
 *  - never admin / co-admin accounts, never yourself,
 *  - never an account with wallet money (take the balance out first, so no money disappears),
 *  - never the wallet that pays a store's subscription,
 *  - money history (purchases, wallet ledger, deposits) is KEPT for accounting; only the login,
 *    the empty wallet row and the personal price overrides are removed.
 */
const DELETABLE = new Set(["user", "reseller", "vip_reseller", "vip reseller", "vip"]);

export async function deleteUser(tenantId: string, targetId: string, actor: { id: string | number | null; username: string }) {
  const db = tdb(tenantId);
  const { data: target, error } = await db.from("users").select("id, username, role").eq("id", targetId).maybeSingle();
  if (error || !target) return { ok: false as const, status: 404, error: "User not found." };
  const username = String(target.username ?? "");
  const role = String(target.role ?? "user").toLowerCase();

  if (String(target.id) === String(actor.id)) return { ok: false as const, status: 400, error: "You cannot delete your own account." };
  if (role === "admin" || role === "coadmin" || !DELETABLE.has(role)) {
    return { ok: false as const, status: 403, error: "Admin accounts cannot be deleted here." };
  }

  if (tenantId === OWNER_TENANT_ID) {
    // a reseller whose wallet pays a store's plan must stay (tolerant if 005 is not applied yet)
    const payer = await supabaseAdmin.from("tenants").select("slug").eq("payer_username", username).limit(1);
    if (!payer.error && (payer.data?.length ?? 0) > 0) {
      return { ok: false as const, status: 409, error: `@${username} owns the store "${(payer.data as any[])[0].slug}". Delete is blocked.` };
    }
  }

  const { data: wallet, error: wErr } = await db.from("wallets").select("balance").eq("username", username).maybeSingle();
  if (wErr) return { ok: false as const, status: 500, error: "Could not check the wallet." };
  const balance = Number(wallet?.balance ?? 0);
  if (balance > 0) {
    return { ok: false as const, status: 409, error: `This account still has ₹${balance.toFixed(2)} in the wallet. Remove the balance first (Manage > Deduct), then delete.` };
  }

  // wallet row only if still empty (a deposit landing right now keeps the account safe)
  if (wallet) {
    const w = await db.from("wallets").delete().eq("username", username).eq("balance", 0);
    if (w.error) return { ok: false as const, status: 500, error: "Could not delete the wallet." };
  }
  await db.from("reseller_price_overrides").delete().eq("username", username);
  const u = await db.from("users").delete().eq("id", targetId);
  if (u.error) return { ok: false as const, status: 500, error: "Could not delete the account." };

  await supabaseAdmin.from("audit_log").insert({
    tenant_id: tenantId, actor_user_id: String(actor.id ?? ""), actor_username: actor.username, action: "user.delete", target: username,
  });
  return { ok: true as const, username };
}

/* ------------------------------ passwords ------------------------------ */
import crypto from "node:crypto";
import { hashPassword, verifyPassword } from "@/lib/auth";

type Actor2 = { id: string | number | null; username: string };
export const PASSWORD_MIN = 8;

/** A readable one-time password (no look-alike characters). Shown ONCE to the admin, only its hash is stored. */
export function tempPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (const b of crypto.randomBytes(10)) out += chars[b % chars.length];
  return out;
}

/** A logged-in user changes their own password (must know the current one). Returns the new stored hash. */
export async function changeOwnPassword(tenantId: string, userId: string | number | null, current: string, next: string) {
  if (String(next ?? "").length < PASSWORD_MIN || String(next).length > 200) return { ok: false as const, error: `New password must be at least ${PASSWORD_MIN} characters.` };
  if (next === current) return { ok: false as const, error: "Choose a different password." };
  const db = tdb(tenantId);
  const r = await db.from("users").select("id, username, password").eq("id", String(userId)).maybeSingle();
  const row: any = r.data;
  if (r.error || !row) return { ok: false as const, error: "Account not found." };
  if (!verifyPassword(String(current ?? ""), String(row.password ?? ""))) return { ok: false as const, error: "Current password is wrong." };
  const hash = hashPassword(next);
  const u = await db.from("users").update({ password: hash }).eq("id", String(row.id));
  if (u.error) return { ok: false as const, error: "Could not change the password. Try again." };
  await supabaseAdmin.from("audit_log").insert({ tenant_id: tenantId, actor_user_id: String(row.id), actor_username: String(row.username), action: "password.changed", target: String(row.username) });
  return { ok: true as const, username: String(row.username), hash, id: String(row.id) };
}

/**
 * A store admin (or the owner, for the main store) resets a customer/reseller password.
 * A new random password is created and returned ONCE; only its hash is stored. Never admins, never yourself.
 */
export async function adminResetPassword(tenantId: string, targetId: string, actor: Actor2) {
  const db = tdb(tenantId);
  const r = await db.from("users").select("id, username, role").eq("id", targetId).maybeSingle();
  const t: any = r.data;
  if (r.error || !t) return { ok: false as const, status: 404, error: "User not found." };
  const role = String(t.role ?? "user").toLowerCase();
  if (String(t.id) === String(actor.id)) return { ok: false as const, status: 400, error: "Use Change password for your own account." };
  if (!DELETABLE.has(role)) return { ok: false as const, status: 403, error: "Admin passwords cannot be reset here." };
  const pw = tempPassword();
  const u = await db.from("users").update({ password: hashPassword(pw) }).eq("id", String(t.id));
  if (u.error) return { ok: false as const, status: 500, error: "Could not reset the password." };
  await supabaseAdmin.from("audit_log").insert({ tenant_id: tenantId, actor_user_id: String(actor.id ?? ""), actor_username: actor.username, action: "password.reset", target: String(t.username) });
  return { ok: true as const, username: String(t.username), password: pw };
}

/** Owner: reset the login of a co-admin store's admin account. Returned once. */
export async function ownerResetStoreAdmin(tenantId: string, actor: Actor2) {
  if (tenantId === OWNER_TENANT_ID) return { ok: false as const, reason: "Not for the main store." };
  const r = await supabaseAdmin.from("users").select("id, username").eq("tenant_id", tenantId).eq("role", "coadmin").order("created_at", { ascending: true }).limit(1);
  const t: any = (r.data as any[])?.[0];
  if (r.error || !t) return { ok: false as const, reason: "This store has no admin account." };
  const pw = tempPassword();
  const u = await supabaseAdmin.from("users").update({ password: hashPassword(pw) }).eq("id", String(t.id)).eq("tenant_id", tenantId);
  if (u.error) return { ok: false as const, reason: "Could not reset." };
  await supabaseAdmin.from("audit_log").insert({ tenant_id: tenantId, actor_user_id: String(actor.id ?? ""), actor_username: actor.username, action: "password.reset_store_admin", target: String(t.username) });
  return { ok: true as const, username: String(t.username), password: pw };
}

/**
 * "Forgot password" step 1: the request is a note for the store admin (nothing is changed, no account is revealed).
 * If the customer also typed the mobile number they signed up with and it matches, the note is marked
 * "mobile verified" so the admin knows the request is genuine.
 */
export async function recordForgot(tenantId: string, username: string, mobile = "") {
  const u = String(username ?? "").trim().slice(0, 64);
  if (!u) return;
  const r = await tdb(tenantId).from("users").select("id, role, mobile_number").eq("username", u).maybeSingle();
  const row: any = r.data;
  if (!row || !DELETABLE.has(String(row.role ?? "user").toLowerCase())) return;
  const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "").slice(-10);
  const verified = digits(mobile).length === 10 && digits(mobile) === digits(row.mobile_number);
  await supabaseAdmin.from("audit_log").insert({ tenant_id: tenantId, actor_user_id: verified ? "mobile-verified" : "", actor_username: u, action: "password.requested", target: u });
}

/** Users who asked for a reset in the last 7 days and were not reset since (+ which of them matched their mobile). */
export async function resetRequestInfo(tenantId: string): Promise<{ users: string[]; verified: string[] }> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const r = await supabaseAdmin.from("audit_log").select("action, target, actor_user_id, created_at").eq("tenant_id", tenantId).in("action", ["password.requested", "password.reset", "password.changed", "password.code_issued", "password.reset_by_code"]).gte("created_at", since).order("created_at", { ascending: true });
  if (r.error) return { users: [], verified: [] };
  const open = new Map<string, boolean>();
  const ver = new Set<string>();
  for (const x of (r.data as any[]) ?? []) {
    const t = String(x.target);
    open.set(t, x.action === "password.requested");
    if (x.action === "password.requested" && x.actor_user_id === "mobile-verified") ver.add(t); else if (x.action !== "password.requested") ver.delete(t);
  }
  const users = [...open].filter(([, v]) => v).map(([k]) => k);
  return { users, verified: users.filter((x) => ver.has(x)) };
}

export async function resetRequests(tenantId: string): Promise<string[]> {
  return (await resetRequestInfo(tenantId)).users;
}

/* ---------------------- one-time reset codes (free, no email needed) ---------------------- */

const CODE_KEY = (username: string) => `pwreset:${String(username).toLowerCase()}`;
const CODE_TTL_MS = 24 * 3_600_000;
const CODE_MAX_TRIES = 5;
const codeHash = (tenantId: string, username: string, code: string) =>
  crypto.createHash("sha256").update(`${tenantId}|${String(username).toLowerCase()}|${String(code).trim().toUpperCase()}`).digest("hex");

function newResetCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (const b of crypto.randomBytes(8)) out += chars[b % chars.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

/** Store admin creates a one-time code for a customer/reseller (valid 24 hours, shown once, only its hash is stored). */
export async function issueResetCode(tenantId: string, targetId: string, actor: Actor2) {
  const r = await tdb(tenantId).from("users").select("id, username, role").eq("id", targetId).maybeSingle();
  const t: any = r.data;
  if (r.error || !t) return { ok: false as const, status: 404, error: "User not found." };
  if (String(t.id) === String(actor.id)) return { ok: false as const, status: 400, error: "Use Change password for your own account." };
  if (!DELETABLE.has(String(t.role ?? "user").toLowerCase())) return { ok: false as const, status: 403, error: "Admin passwords cannot be reset here." };
  const code = newResetCode();
  const w = await writeSetting(tenantId, CODE_KEY(t.username), { hash: codeHash(tenantId, t.username, code), exp: Date.now() + CODE_TTL_MS, tries: 0 });
  if (w.error) return { ok: false as const, status: 500, error: "Could not create the code." };
  await supabaseAdmin.from("audit_log").insert({ tenant_id: tenantId, actor_user_id: String(actor.id ?? ""), actor_username: actor.username, action: "password.code_issued", target: String(t.username) });
  return { ok: true as const, username: String(t.username), code, hours: 24 };
}

/** Customer uses the code to choose a new password. Same generic failure for every problem. */
export async function redeemResetCode(tenantId: string, username: string, code: string, next: string) {
  const bad = { ok: false as const, error: "That code is wrong or expired. Ask your store admin for a new one." };
  const u = String(username ?? "").trim().slice(0, 64);
  if (!u || !String(code ?? "").trim()) return bad;
  if (String(next ?? "").length < PASSWORD_MIN || String(next).length > 200) return { ok: false as const, error: `New password must be at least ${PASSWORD_MIN} characters.` };
  const rec = await readSetting(tenantId, CODE_KEY(u));
  const v: any = rec.data?.value;
  if (rec.error || !v || typeof v !== "object" || !v.hash) return bad;
  if (Number(v.exp) < Date.now() || Number(v.tries) >= CODE_MAX_TRIES) return bad;
  const given = Buffer.from(codeHash(tenantId, u, code), "hex");
  const want = Buffer.from(String(v.hash), "hex");
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    await writeSetting(tenantId, CODE_KEY(u), { ...v, tries: Number(v.tries || 0) + 1 });
    return bad;
  }
  const r = await tdb(tenantId).from("users").select("id, username, role").eq("username", u).maybeSingle();
  const row: any = r.data;
  if (r.error || !row || !DELETABLE.has(String(row.role ?? "user").toLowerCase())) return bad;
  const up = await tdb(tenantId).from("users").update({ password: hashPassword(next) }).eq("id", String(row.id));
  if (up.error) return { ok: false as const, error: "Could not change the password. Try again." };
  await writeSetting(tenantId, CODE_KEY(u), null); // one use only
  await supabaseAdmin.from("audit_log").insert({ tenant_id: tenantId, actor_user_id: String(row.id), actor_username: String(row.username), action: "password.reset_by_code", target: String(row.username) });
  return { ok: true as const, username: String(row.username) };
}

/* ------------------------------ create account (admin) ------------------------------ */
import { creditWallet, logWalletTransaction } from "@/lib/wallet";

const CREATE_OWNER_ROLES = ["user", "reseller", "admin"];
const CREATE_STORE_ROLES = ["user", "reseller"];

/**
 * A store admin creates an account INSIDE THEIR OWN STORE (tenant from the verified session, never from the body):
 * username + password + role + optional starting balance. The password is stored hashed.
 * A co-admin store can only create customer/reseller accounts; only the owner store may create admins.
 * The starting balance goes through the same wallet function and ledger as "Manage > Add funds".
 */
export async function createAccount(
  tenantId: string,
  input: { username?: unknown; password?: unknown; role?: unknown; balance?: unknown; email?: unknown; mobile?: unknown },
  actor: Actor2,
) {
  const username = String(input.username ?? "").trim();
  const password = String(input.password ?? "");
  const role = String(input.role ?? "user").trim();
  const email = String(input.email ?? "").trim();
  const mobile = String(input.mobile ?? "").trim();
  const balance = Math.round(Number(input.balance ?? 0) * 100) / 100;

  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) return { ok: false as const, status: 400, error: "Username must be 3-32 letters, numbers, . _ -" };
  if (password.length < 6 || password.length > 200) return { ok: false as const, status: 400, error: "Password must be at least 6 characters." };
  const allowed = tenantId === OWNER_TENANT_ID ? CREATE_OWNER_ROLES : CREATE_STORE_ROLES;
  if (!allowed.includes(role)) return { ok: false as const, status: 400, error: "Invalid role." };
  if (email && (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { ok: false as const, status: 400, error: "Enter a valid email." };
  if (mobile && (mobile.replace(/\D/g, "").length < 10 || mobile.length > 20)) return { ok: false as const, status: 400, error: "Enter a valid mobile number." };
  if (input.balance !== undefined && input.balance !== "" && (!Number.isFinite(balance) || balance < 0 || balance > 1_000_000)) {
    return { ok: false as const, status: 400, error: "Starting balance must be between 0 and 1,000,000." };
  }

  const db = tdb(tenantId);
  const ex = await db.from("users").select("id").eq("username", username).limit(1);
  if (ex.error) return { ok: false as const, status: 500, error: "Could not check the username." };
  if ((ex.data?.length ?? 0) > 0) return { ok: false as const, status: 409, error: "That username already exists." };

  const ins = await db.from("users").insert([{ username, password: hashPassword(password), email, mobile_number: mobile, role }]);
  if (ins.error) return { ok: false as const, status: 400, error: "Could not create the account." };

  let funded = 0;
  let warning = "";
  if (balance > 0) {
    const r = await creditWallet(tenantId, username, balance);
    if (r.ok) {
      funded = balance;
      await logWalletTransaction({ tenantId, username, type: "credit", amount: balance, balance_after: r.balance, description: "Admin added starting balance" });
    } else {
      warning = "Account created, but the starting balance could not be added. Use Manage > Add funds.";
    }
  }
  await supabaseAdmin.from("audit_log").insert({ tenant_id: tenantId, actor_user_id: String(actor.id ?? ""), actor_username: actor.username, action: "user.create", target: username });
  return { ok: true as const, username, role, balance: funded, warning };
}
