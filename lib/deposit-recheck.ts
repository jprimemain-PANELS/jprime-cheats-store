import { supabaseAdmin } from "@/lib/supabase-admin";
import { tdb } from "@/lib/tenant-db";
import { getGatewayConfig, gatewayNeedsUtr, normalizeBankReference, resolveGatewayId, verifyGatewayPayment } from "@/lib/payment-gateway";

/**
 * Admin tool for a stuck top-up: asks the provider about the order again and, ONLY if the provider says PAID for the
 * exact amount, credits the customer through the same atomic database function the customer page uses
 * (safe to repeat: already-credited deposits are never credited twice).
 */
export async function recheckDeposit(tenantId: string, orderId: string): Promise<{ ok: boolean; status: string; message: string }> {
  const { data: deposit, error } = await tdb(tenantId).from("deposit_history").select("*").eq("gateway_order_id", orderId).maybeSingle();
  if (error) return { ok: false, status: "error", message: "Could not load the deposit." };
  if (!deposit) return { ok: false, status: "not_found", message: "No deposit with this order ID in this store." };
  const d: any = deposit;
  if (d.status === "success") return { ok: true, status: "already_credited", message: "Already credited earlier. Nothing to do." };
  if (d.status !== "pending") return { ok: false, status: "closed", message: `This deposit is ${d.status}; it cannot be rechecked.` };

  const gatewayId = resolveGatewayId(d.gateway);
  if (gatewayNeedsUtr(gatewayId)) return { ok: false, status: "needs_utr", message: "This gateway needs the customer's UTR; recheck is only for automatic gateways." };
  const cfg = await getGatewayConfig(gatewayId, true, tenantId);
  if (!cfg.apiKey) return { ok: false, status: "no_key", message: "No API key saved for this gateway." };

  const v = await verifyGatewayPayment(cfg, { orderId });
  if (v.state === "pending") return { ok: false, status: "pending", message: "The provider still says PENDING: it has not detected this payment. Ask the provider to check this order ID." };
  if (v.state === "expired") return { ok: false, status: "expired", message: "The provider says this order EXPIRED without a detected payment." };
  if (v.state === "failed") return { ok: false, status: "failed", message: v.message };

  const expected = Number(d.amount);
  if (!Number.isFinite(expected) || expected <= 0 || Math.abs(expected - Number(v.amount)) > 0.01) {
    return { ok: false, status: "amount_mismatch", message: "The provider reports a different amount than the order. Not credited." };
  }
  const utr = normalizeBankReference(orderId, v.utr, { fallbackToOrder: true });
  const { data: fin, error: finErr } = await supabaseAdmin.rpc("jprime_t_finalize_wallet_deposit", {
    p_tenant: tenantId, p_gateway_order_id: orderId, p_username: d.username, p_utr: utr, p_amount: expected,
  });
  if (finErr) return { ok: false, status: "credit_retry", message: "Provider says PAID but the wallet credit failed. Try again." };
  const r: any = fin;
  if (r?.ok === true && r?.status === "success") return { ok: true, status: "credited", message: `Credited ₹${expected} to @${d.username}.` };
  if (r?.status === "already_verified") return { ok: true, status: "already_credited", message: "Already credited earlier." };
  return { ok: false, status: String(r?.status || "rejected"), message: "The database refused this credit (duplicate reference or review needed)." };
}
