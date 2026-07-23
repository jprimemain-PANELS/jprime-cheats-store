import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const FP_VERIFY_URL = "https://xyzcheats.com/gateway/verify.php";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const gatewayOrderId = body.order_id || body.gateway_order_id;
    const rawUtr = body.utr;
    const utr = rawUtr ? String(rawUtr).replace(/\D/g, "") : "";

    // 1. Input Verification
    if (!gatewayOrderId) {
      return NextResponse.json(
        { success: false, status: "invalid_request", message: "Missing order reference." },
        { status: 400 }
      );
    }

    if (!utr || utr.length < 10) {
      return NextResponse.json(
        { success: false, status: "invalid_utr", message: "Invalid UTR format. Must be at least 10 digits." },
        { status: 400 }
      );
    }

    const apiKey = process.env.FP_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, status: "gateway_failed", message: "Gateway not configured properly." },
        { status: 500 }
      );
    }

    // 2. Find existing deposit order
    const { data: deposit, error: depositError } = await supabase
      .from("deposit_history")
      .select("*")
      .eq("gateway_order_id", gatewayOrderId)
      .maybeSingle();

    if (depositError) {
      return NextResponse.json(
        { success: false, status: "error", message: "Unable to load deposit records." },
        { status: 500 }
      );
    }

    if (!deposit) {
      return NextResponse.json(
        { success: false, status: "not_found", message: "Payment order record not found." },
        { status: 404 }
      );
    }

    // 3. Already Verified
    if (deposit.status === "success") {
      return NextResponse.json(
        { success: false, status: "already_verified", message: "This deposit has already been credited." },
        { status: 409 }
      );
    }

    // 4. Duplicate UTR Check
    const { data: duplicateCheck } = await supabase
      .from("deposit_history")
      .select("id")
      .eq("utr", utr)
      .not("gateway_order_id", "eq", gatewayOrderId)
      .maybeSingle();

    if (duplicateCheck) {
      return NextResponse.json(
        { success: false, status: "duplicate_utr", message: "This UTR was already applied to another payment." },
        { status: 409 }
      );
    }

    // 5. Gateway Verification Call
    const verifyUrl = new URL(FP_VERIFY_URL);
    verifyUrl.searchParams.set("order_id", String(gatewayOrderId));
    verifyUrl.searchParams.set("api_key", apiKey);
    verifyUrl.searchParams.set("utr", utr);

    const gatewayResponse = await fetch(verifyUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const responseText = await gatewayResponse.text();
    let gatewayData: any;

    try {
      gatewayData = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { success: false, status: "gateway_failed", message: "Invalid data returned from payment gateway." },
        { status: 502 }
      );
    }

    if (gatewayData?.status === "pending") {
      return NextResponse.json(
        {
          success: false,
          status: "pending",
          message: "Payment remains inside processing state. Please wait a moment and retry.",
        },
        { status: 202 }
      );
    }

    // Strict Gatekeeper: Status MUST explicitly equal "success"
    if (
      !gatewayResponse.ok ||
      gatewayData?.status !== "success" ||
      !gatewayData?.data
    ) {
      return NextResponse.json(
        {
          success: false,
          status: "invalid_utr",
          message: gatewayData?.message || "Invalid UTR or transaction not found with bank network.",
        },
        { status: 400 } // Added explicit status code
      );
    }

    const payment = gatewayData.data;
    const expectedAmount = Number(deposit.amount);
    const paidAmount = Number(payment.amount);

    // Check for lower or invalid amounts
    if (Math.abs(expectedAmount - paidAmount) > 0.01) {
      return NextResponse.json(
        {
          success: false,
          status: "amount_mismatch",
          message: `Amount mismatch: Expected ₹${expectedAmount}, but paid ₹${paidAmount}.`,
        },
        { status: 409 }
      );
    }

    // 6. Database Updates
    const { data: wallet, error: walletLoadError } = await supabase
      .from("wallets")
      .select("*")
      .eq("username", deposit.username)
      .maybeSingle();

    if (walletLoadError) {
      return NextResponse.json(
        { success: false, status: "error", message: "Failed to read user wallet balance." },
        { status: 500 }
      );
    }

    const currentBalance = wallet ? Number(wallet.balance) : 0;
    const newBalance = currentBalance + paidAmount;

    if (wallet) {
      const { error: updErr } = await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("username", deposit.username);

      if (updErr) throw new Error(`Wallet balance update failed: ${updErr.message}`);
    } else {
      const { error: insErr } = await supabase
        .from("wallets")
        .insert({ username: deposit.username, balance: newBalance });

      if (insErr) throw new Error(`Wallet creation failed: ${insErr.message}`);
    }

    // Log transaction
    await supabase.from("wallet_transactions").insert({
      username: deposit.username,
      type: "deposit",
      amount: paidAmount,
      balance_after: newBalance,
      description: "Wallet Deposit Verification Successful",
    });

    // Mark deposit as success
    await supabase
      .from("deposit_history")
      .update({
        status: "success",
        utr: payment.utr || utr,
      })
      .eq("gateway_order_id", gatewayOrderId);

    return NextResponse.json({
      success: true,
      status: "success",
      balance: newBalance,
      message: "Payment verified and credited successfully!",
    });

  } catch (err: any) {
    console.error("Critical Verification Exception:", err);
    return NextResponse.json(
      { success: false, status: "error", message: err?.message || "Internal server error during verification." },
      { status: 500 }
    );
  }
}