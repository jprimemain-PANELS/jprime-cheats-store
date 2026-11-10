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
