import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, rateLimit } from "@/lib/auth";
import { creditWallet, logWalletTransaction } from "@/lib/wallet";

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
      return reply(429, { success: false, status: "rate_limited", message: "Too many attempts. Please wait a moment." });
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

    // 1. Load the deposit - and make sure it belongs to this user.
    const { data: deposit, error: depositError } = await supabaseAdmin
      .from("deposit_history")
      .select("*")
      .eq("gateway_order_id", gatewayOrderId)
      .maybeSingle();

    if (depositError) {
      return reply(500, { success: false, status: "error", message: "Unable to load deposit records." });
    }
    if (!deposit || deposit.username !== username) {
      return reply(404, { success: false, status: "not_found", message: "Payment order record not found." });
    }
    if (deposit.status === "success") {
      return reply(409, { success: false, status: "already_verified", message: "This deposit has already been credited." });
    }
    if (deposit.status !== "pending") {
      return reply(409, { success: false, status: "error", message: "This deposit can no longer be verified." });
    }

    // 2. Replay protection: UTR already used by another deposit or purchase order.
    const { data: dupDeposit } = await supabaseAdmin
      .from("deposit_history")
      .select("id")
      .eq("utr", utr)
      .neq("gateway_order_id", gatewayOrderId)
      .limit(1);

    let duplicate = Boolean(dupDeposit && dupDeposit.length > 0);

    if (!duplicate) {
      const { data: dupOrder, error: dupOrderError } = await supabaseAdmin
        .from("payment_orders")
        .select("gateway_order_id")
        .eq("utr", utr)
        .limit(1);
      duplicate = !dupOrderError && Boolean(dupOrder && dupOrder.length > 0);
    }

    if (duplicate) {
      return reply(409, { success: false, status: "duplicate_utr", message: "This UTR was already applied to another payment." });
    }

    // 3. Ask the gateway.
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
        message: "Payment remains inside processing state. Please wait a moment and retry.",
      });
    }

    if (!gatewayResponse.ok || gatewayData?.status !== "success" || !gatewayData?.data) {
      return reply(400, {
        success: false,
        status: "invalid_utr",
        message: gatewayData?.message || "Invalid UTR or transaction not found with bank network.",
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

    // 4. Atomically claim the deposit (pending -> success). Only ONE request can win,
    //    so a deposit can never be credited twice, even under concurrent retries.
    const claimBase = { status: "success" as const };
    let claim = await supabaseAdmin
      .from("deposit_history")
      .update({ ...claimBase, utr: String(payment.utr || utr).replace(/\D/g, "") || utr })
      .eq("gateway_order_id", gatewayOrderId)
      .eq("status", "pending")
      .select("gateway_order_id")
      .maybeSingle();

    if (claim.error) {
      if (claim.error.code === "23505") {
        return reply(409, { success: false, status: "duplicate_utr", message: "This UTR was already applied to another payment." });
      }
      return reply(500, { success: false, status: "error", message: "Could not safely credit the deposit." });
    }
    if (!claim.data) {
      return reply(409, { success: false, status: "already_verified", message: "This deposit has already been credited." });
    }

    // 5. Credit the wallet (compare-and-swap). If it fails, release the claim so it can be retried.
    const credit = await creditWallet(username, expectedAmount);

    if (!credit.ok) {
      await supabaseAdmin
        .from("deposit_history")
        .update({ status: "pending" })
        .eq("gateway_order_id", gatewayOrderId)
        .eq("status", "success");

      console.error("WALLET CREDIT FAILED, DEPOSIT RELEASED:", gatewayOrderId);
      return reply(500, { success: false, status: "error", message: "Could not credit your wallet. Please retry." });
    }

    await logWalletTransaction({
      username,
      type: "deposit",
      amount: expectedAmount,
      balance_after: credit.balance,
      description: "Wallet Deposit Verification Successful",
    });

    return reply(200, {
      success: true,
      status: "success",
      balance: credit.balance,
      message: "Payment verified and credited successfully!",
    });
  } catch (err) {
    console.error("WALLET VERIFY ERROR:", err instanceof Error ? err.message : "unknown");
    return reply(500, { success: false, status: "error", message: "Internal server error during verification." });
  }
}
