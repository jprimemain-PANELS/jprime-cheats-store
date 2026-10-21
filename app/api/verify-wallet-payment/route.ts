import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, rateLimit } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FP_VERIFY_URL = "https://xyzcheats.com/gateway/verify.php";
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
    const utr = String(body?.utr ?? "").replace(/\D/g, "");

    if (!gatewayOrderId) {
      return reply(400, { success: false, status: "invalid_request", message: "Missing order reference." });
    }
    if (!utr || utr.length < 10 || utr.length > 30) {
      return reply(400, { success: false, status: "invalid_utr", message: "Invalid UTR format. Must be at least 10 digits." });
    }

    const apiKey = process.env.FP_API_KEY;
    if (!apiKey) {
      return reply(500, { success: false, status: "gateway_failed", message: "Gateway not configured properly." });
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
    if (deposit.status === "success") {
      return reply(409, { success: false, status: "already_verified", message: "This deposit has already been credited. Refresh your wallet balance." });
    }
    if (deposit.status !== "pending") {
      return reply(409, { success: false, status: "error", message: "This deposit can no longer be verified." });
    }

    // Ask the payment gateway to independently confirm this exact order + UTR.
    const verifyUrl = new URL(FP_VERIFY_URL);
    verifyUrl.searchParams.set("order_id", gatewayOrderId);
    verifyUrl.searchParams.set("api_key", apiKey);
    verifyUrl.searchParams.set("utr", utr);

    const gatewayResponse = await fetch(verifyUrl.toString(), { method: "GET", cache: "no-store" });
    let gatewayData: any;
    try {
      gatewayData = JSON.parse(await gatewayResponse.text());
    } catch {
      return reply(502, { success: false, status: "gateway_failed", message: "Invalid data returned from payment gateway." });
    }

    if (gatewayData?.status === "pending") {
      return reply(202, {
        success: false,
        status: "pending",
        message: "Payment is still processing. Wait a moment and retry this same order.",
      });
    }
    if (!gatewayResponse.ok || gatewayData?.status !== "success" || !gatewayData?.data) {
      return reply(400, {
        success: false,
        status: "invalid_utr",
        message: gatewayData?.message || "The payment gateway could not verify this UTR.",
      });
    }

    const payment = gatewayData.data;
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

    const verifiedUtr = String(payment.utr || utr).replace(/\D/g, "") || utr;

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
        message: "Your payment was verified, but wallet credit could not be confirmed. Do not create another payment. Retry verification using this same order and UTR, or contact support.",
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
