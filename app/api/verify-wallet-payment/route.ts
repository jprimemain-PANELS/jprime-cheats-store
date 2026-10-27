import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, rateLimit } from "@/lib/auth";
import {
  gatewayNeedsUtr,
  getGatewayConfig,
  resolveGatewayId,
  verifyGatewayPayment,
} from "@/lib/payment-gateway";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function reply(status: number, payload: Record<string, unknown>) {
  return NextResponse.json(payload, { status, headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const { username } = auth.user;
    if (!rateLimit(`verify-topup:${username}`, 20, 60_000)) {
      return reply(429, {
        success: false,
        status: "rate_limited",
        message: "Too many attempts. Please wait a moment.",
      });
    }

    const body = await request.json().catch(() => ({}));
    const gatewayOrderId = String(body?.order_id || body?.gateway_order_id || "").trim();
    const utrInput = String(body?.utr ?? "").replace(/\D/g, "");

    if (!gatewayOrderId) {
      return reply(400, { success: false, status: "invalid_request", message: "Missing order reference." });
    }

    const { data: deposit, error: depositError } = await supabaseAdmin
      .from("deposit_history")
      .select("*")
      .eq("gateway_order_id", gatewayOrderId)
      .maybeSingle();

    if (depositError) {
      console.error("DEPOSIT LOOKUP ERROR:", depositError.message);
      return reply(500, { success: false, status: "error", message: "Unable to load deposit records." });
    }
    if (!deposit || deposit.username !== username) {
      return reply(404, { success: false, status: "not_found", message: "Payment order record not found." });
    }

    // The gateway that created this deposit decides how it is verified.
    const gatewayId = resolveGatewayId((deposit as any).gateway);
    const needsUtr = gatewayNeedsUtr(gatewayId);

    if (needsUtr && (!utrInput || utrInput.length < 10 || utrInput.length > 30)) {
      return reply(400, { success: false, status: "invalid_utr", message: "Invalid UTR format. Must be at least 10 digits." });
    }

    if (deposit.status === "success") {
      return reply(409, { success: false, status: "already_verified", message: "This deposit has already been credited. Refresh your wallet balance." });
    }
    if (deposit.status !== "pending") {
      return reply(409, { success: false, status: "error", message: "This deposit can no longer be verified." });
    }

    const cfg = await getGatewayConfig(gatewayId);
    if (!cfg.apiKey) {
      console.error(`${gatewayId} gateway API key is missing`);
      return reply(500, { success: false, status: "gateway_failed", message: "Gateway not configured properly." });
    }

    // Ask the payment gateway to independently confirm this exact order (+ UTR for xyz).
    const verification = await verifyGatewayPayment(cfg, { orderId: gatewayOrderId, utr: utrInput });

    if (verification.state === "pending") {
      return reply(202, {
        success: false,
        status: "pending",
        message: needsUtr
          ? "Payment is still processing. Wait a moment and retry this same order."
          : "Waiting for your payment. This page updates automatically once it arrives.",
      });
    }
    if (verification.state === "expired") {
      return reply(410, {
        success: false,
        status: "expired",
        message: "This payment session expired. Please start a new deposit.",
      });
    }
    if (verification.state === "failed") {
      if (verification.gatewayDown) {
        return reply(502, { success: false, status: "gateway_failed", message: verification.message });
      }
      return reply(needsUtr ? 400 : verification.httpStatus, {
        success: false,
        status: needsUtr ? "invalid_utr" : "failed",
        message: needsUtr
          ? verification.message || "The payment gateway could not verify this UTR."
          : verification.message,
      });
    }

    const payment = verification;
    const expectedAmount = Number(deposit.amount);
    const paidAmount = Number(payment.amount);
    if (
      !Number.isFinite(expectedAmount) ||
      !Number.isFinite(paidAmount) ||
      expectedAmount <= 0 ||
      Math.abs(expectedAmount - paidAmount) > 0.01
    ) {
      return reply(409, { success: false, status: "amount_mismatch", message: "Payment amount does not match the order." });
    }

    // Bank reference used by the database function for replay protection.
    let verifiedUtr = "";
    if (needsUtr) {
      verifiedUtr = String(payment.utr || utrInput).replace(/\D/g, "") || utrInput;
    } else {
      verifiedUtr = String(payment.utr || "").replace(/\D/g, "");
      if (verifiedUtr.length < 10 || verifiedUtr.length > 30) {
        console.error("GATEWAY PAID WITHOUT A USABLE BANK REFERENCE:", { gatewayOrderId, gateway: gatewayId });
        return reply(409, {
          success: false,
          status: "manual_review",
          message: "Payment was received but needs a manual check. Do not pay again; contact support with this order reference.",
        });
      }
    }

    // Database RPC finalizes status + wallet credit + ledger entry in ONE transaction.
    // If it errors, PostgreSQL rolls the transaction back; retrying the same order is safe.
    const { data: finalized, error: finalizeError } = await supabaseAdmin.rpc(
      "jprime_finalize_wallet_deposit",
      {
        p_gateway_order_id: gatewayOrderId,
        p_username: username,
        p_utr: verifiedUtr,
        p_amount: expectedAmount,
      }
    );

    if (finalizeError) {
      console.error("WALLET DEPOSIT FINALIZATION ERROR:", finalizeError.message);
      return reply(500, {
        success: false,
        status: "credit_retry",
        message: "Your payment was verified, but wallet credit could not be confirmed. Do not create another payment. Retry verification using this same order, or contact support.",
      });
    }

    const result = finalized as Record<string, unknown> | null;
    const resultStatus = String(result?.status || "");

    if (result?.ok === true && resultStatus === "success") {
      return reply(200, {
        success: true,
        status: "success",
        balance: Number(result.balance ?? 0),
        message: "Payment verified and credited successfully!",
      });
    }
    if (resultStatus === "duplicate_utr") {
      return reply(409, { success: false, status: "duplicate_utr", message: "This UTR was already applied to another payment. Use the reference for this payment only." });
    }
    if (resultStatus === "manual_review") {
      return reply(409, { success: false, status: "manual_review", message: "This earlier payment needs a balance check before it can be retried. Do not make another payment; contact support with this order reference." });
    }
    if (resultStatus === "already_verified") {
      return reply(409, { success: false, status: "already_verified", message: "This deposit has already been credited. Refresh your wallet balance." });
    }
    if (resultStatus === "amount_mismatch") {
      return reply(409, { success: false, status: "amount_mismatch", message: "Payment amount does not match the order." });
    }
    if (resultStatus === "not_found") {
      return reply(404, { success: false, status: "not_found", message: "Payment order record not found." });
    }

    console.error("WALLET DEPOSIT FINALIZATION REJECTED:", resultStatus || "unknown status");
    return reply(409, { success: false, status: "error", message: "Could not finalize this deposit safely. Please contact support with your order reference." });
  } catch (err) {
    console.error("WALLET VERIFY ERROR:", err instanceof Error ? err.message : "unknown");
    return reply(500, { success: false, status: "error", message: "Internal server error during verification." });
  }
}