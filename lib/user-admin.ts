import { supabaseAdmin } from "@/lib/supabase-admin";
import { OWNER_TENANT_ID, tdb } from "@/lib/tenant-db";

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

/** "Forgot password": the request is only a note for the store admin (nothing is changed, no account is revealed). */
export async function recordForgot(tenantId: string, username: string) {
  const u = String(username ?? "").trim().slice(0, 64);
  if (!u) return;
  const r = await tdb(tenantId).from("users").select("id").eq("username", u).maybeSingle();
  if (!r.data) return;
  await supabaseAdmin.from("audit_log").insert({ tenant_id: tenantId, actor_user_id: "", actor_username: u, action: "password.requested", target: u });
}

/** Users who asked for a reset in the last 7 days and were not reset since. */
export async function resetRequests(tenantId: string): Promise<string[]> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const r = await supabaseAdmin.from("audit_log").select("action, target, created_at").eq("tenant_id", tenantId).in("action", ["password.requested", "password.reset", "password.changed"]).gte("created_at", since).order("created_at", { ascending: true }).limit(500);
  if (r.error) return [];
  const open = new Map<string, boolean>();
  for (const x of (r.data as any[]) ?? []) open.set(String(x.target), x.action === "password.requested");
  return [...open].filter(([, v]) => v).map(([k]) => k);
}
