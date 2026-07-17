"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type PaymentOrder = {
  order_id: string;
  amount: string | number;
  status: string;
  used: boolean;
  qr_url: string | null;
  upi_link: string | null;
  expires_at: string | null;
};

function UpiPaymentContent() {
  const params = useSearchParams();
  const router = useRouter();

  const orderId = params.get("order_id") || "";

  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "success" | "expired" | "error">("pending");

  const [releasedKey, setReleasedKey] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState(300);

  const verifyingRef = useRef(false);
  const successHandledRef = useRef(false);

  const [utr, setUtr] = useState("");
  const [verifying, setVerifying] = useState(false);

  // ─────────────────────────────────────
  // LOAD EXACT PAYMENT ORDER
  // ─────────────────────────────────────
  useEffect(() => {
    if (!orderId) {
      router.replace("/");
      return;
    }

    async function loadOrder() {
      try {
        const response = await fetch("/api/get-payment-order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ order_id: orderId }),
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.success || !result.order) {
          setErrorMessage(result.error || "Payment order not found.");
          setPaymentStatus("error");
          setIsLoading(false);
          return;
        }

        setOrder(result.order);

        if (result.order.status === "success") {
          setPaymentStatus("success");
        }

        if (result.order.expires_at) {
          const expiryTime = new Date(result.order.expires_at).getTime();
          const remainingSeconds = Math.max(
            0,
            Math.floor((expiryTime - Date.now()) / 1000)
          );

          setTimeLeft(remainingSeconds);

          if (remainingSeconds <= 0 && result.order.status !== "success") {
            setPaymentStatus("expired");
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error("LOAD ORDER ERROR:", error);
        setErrorMessage("Unable to load payment order.");
        setPaymentStatus("error");
        setIsLoading(false);
      }
    }

    loadOrder();
  }, [orderId, router]);

  // ─────────────────────────────────────
  // VERIFY PAYMENT WITH OUR SERVER
  // ─────────────────────────────────────
  const verifyPayment = useCallback(async () => {
    if (
      !orderId ||
      verifyingRef.current ||
      successHandledRef.current ||
      paymentStatus === "expired"
    ) {
      return;
    }

    // Step 1: Log verification payload state right before execution
    console.log("UTR STATE:", utr);

    verifyingRef.current = true;
    setVerifying(true);
    setErrorMessage(""); // Clear previous error layout states

    try {
      const response = await fetch("/api/verify-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gateway_order_id: orderId,
          utr: utr,
        }),
        cache: "no-store",
      });

      const result = await response.json();
      console.log("VERIFY RESULT:", result);

      if (result.status === "pending") {
        setErrorMessage("⏳ Payment validation processing. Please wait a brief moment and verify again.");
        return;
      }

      if (result.status === "success" || result.success === true) {
        successHandledRef.current = true;
        setPaymentStatus("success");
        if (result.key) {
          setReleasedKey(result.key);
        }
        return;
      }

      if (result.status === "out_of_stock") {
        setErrorMessage(
          "Payment received successfully, but the selected product is currently out of stock. Please contact support."
        );
        setPaymentStatus("error");
        return;
      }

      if (result.status === "amount_mismatch") {
        setErrorMessage(
          "Payment verification failed because the paid amount does not match the order."
        );
        setPaymentStatus("error");
        return;
      }

      // Handling direct user failures / invalid UTR mismatch errors
      if (!response.ok || result.success === false || result.status === "failed") {
        setErrorMessage("❌ Invalid UTR. Please check your UTR number and try again.");
        return;
      }
    } catch (error) {
      console.error("VERIFY PAYMENT ERROR:", error);
      setErrorMessage("❌ System connection error. Failed to reach verification gateway.");
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  }, [orderId, paymentStatus, utr]);

  // ─────────────────────────────────────
  // REAL EXPIRY COUNTDOWN
  // ─────────────────────────────────────
  useEffect(() => {
    if (!order?.expires_at || paymentStatus !== "pending") {
      return;
    }

    const updateCountdown = () => {
      const expiryTime = new Date(order.expires_at as string).getTime();
      const remainingSeconds = Math.max(
        0,
        Math.floor((expiryTime - Date.now()) / 1000)
      );

      setTimeLeft(remainingSeconds);

      if (remainingSeconds <= 0) {
        setPaymentStatus("expired");
      }
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [order?.expires_at, paymentStatus]);

  // ─────────────────────────────────────
  // AUTO COPY RELEASED KEY
  // ─────────────────────────────────────
  useEffect(() => {
    if (!releasedKey) return;

    navigator.clipboard
      .writeText(releasedKey)
      .then(() => {
        setCopyMessage("✅ Key copied to clipboard!");
      })
      .catch(() => {
        setCopyMessage("⚠️ Auto-copy failed. Use COPY KEY.");
      });

    const timer = window.setTimeout(() => {
      setCopyMessage("");
    }, 8000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [releasedKey]);

  // ─────────────────────────────────────
  // MANUAL COPY
  // ─────────────────────────────────────
  const copyKey = async () => {
    if (!releasedKey) return;

    try {
      await navigator.clipboard.writeText(releasedKey);
      setCopyMessage("✅ Key copied to clipboard!");
    } catch {
      setCopyMessage("⚠️ Copy failed. Please select the key manually.");
    }

    window.setTimeout(() => {
      setCopyMessage("");
    }, 8000);
  };

  // ─────────────────────────────────────
  // DISPLAY VALUES
  // ─────────────────────────────────────
  const formattedAmount = Number(order?.amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const seconds = String(timeLeft % 60).padStart(2, "0");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050506] text-cyan-400 flex items-center justify-center font-mono text-xs tracking-widest uppercase">
        Connecting to Payment Gateway...
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#050506] text-[#F3F4F6] font-sans flex items-center justify-center p-4 antialiased selection:bg-cyan-500 selection:text-black relative overflow-hidden">
      {copyMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] bg-emerald-500 text-black px-4 py-2 rounded-lg font-bold shadow-lg text-xs tracking-wider uppercase text-center">
          {copyMessage}
        </div>
      )}

      {/* BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-tr from-[#08090a] via-[#050506] to-[#0d0f12]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/[0.03] rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-[440px] relative z-10">
        <div className="bg-[#0A0B0D] border border-white/[0.06] rounded-2xl p-6 sm:p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.85)]">
          {/* HEADER */}
          <div className="flex flex-col items-center text-center mb-8">
            <span className="text-[10px] tracking-[0.35em] uppercase font-semibold text-cyan-400 mb-1.5">
              Secure Checkout Protocol
            </span>
            <h2 className="text-2xl font-light tracking-[0.18em] uppercase text-white">
              JPRIME CHEATS
            </h2>
            <div className="h-[1px] w-16 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent mt-3.5" />
          </div>

          {/* AMOUNT */}
          <div className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 text-center mb-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-1">
              Amount Due
            </p>
            <p className="text-4xl font-extralight tracking-tight text-white font-mono">
              ₹{formattedAmount}
            </p>
          </div>

          {/* ERROR STATUS RENDERING */}
          {errorMessage && (
            <div className="mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono text-center leading-relaxed">
              {errorMessage}
            </div>
          )}

          {/* PENDING PAYMENT */}
          {paymentStatus === "pending" && (
            <>
              <div className="bg-[#0E1013] border border-white/[0.04] p-5 rounded-xl mb-6 flex flex-col items-center">
                {order?.qr_url ? (
                  <div className="w-full aspect-square max-w-[250px] bg-white p-3 rounded-xl">
                    <img
                      src={order.qr_url}
                      alt="UPI Payment QR"
                      className="w-full h-full object-contain rounded-md"
                    />
                  </div>
                ) : (
                  <div className="w-full aspect-square max-w-[250px] bg-[#050506] border border-red-500/20 rounded-xl flex items-center justify-center text-red-400 text-xs text-center p-6">
                    QR code unavailable.
                  </div>
                )}

                <div className="mt-4 flex flex-col items-center gap-1">
                  <div className="text-base font-mono font-light tracking-[0.2em] text-cyan-400">
                    {minutes}:{seconds}
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-neutral-500 tracking-wider font-mono uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                    Session Expiry Countdown
                  </div>
                </div>
              </div>

              <div className="space-y-3.5 mb-7 border-t border-b border-white/[0.05] py-4 px-0.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400 tracking-wide">Order ID</span>
                  <span className="font-mono text-cyan-400 text-[10px] max-w-[220px] truncate select-all">
                    {orderId}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400 tracking-wide">Network</span>
                  <span className="font-mono text-neutral-300 text-[11px]">
                    UPI.INSTANT.SECURE
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400 tracking-wide">Status</span>
                  <span className="tracking-wider text-[11px] font-medium uppercase text-cyan-400 animate-pulse">
                    Awaiting Payment
                  </span>
                </div>
              </div>

              {order?.upi_link && (
                <>
                  <a
                    href={order.upi_link}
                    className="flex items-center justify-center w-full bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-black font-bold text-xs uppercase tracking-[0.2em] py-4 rounded-xl transition-all duration-200"
                  >
                    PAY NOW
                  </a>

                  <div className="mt-6">
                    <p className="text-xs text-neutral-400 mb-2">
                      Enter 12-digit UTR after payment
                    </p>

                    <input
                      type="text"
                      placeholder="Enter UTR Number"
                      maxLength={12}
                      value={utr}
                      onChange={(e) => {
                        console.log("INPUT:", e.target.value);
                        setErrorMessage(""); 
                        setUtr(e.target.value.replace(/\D/g, ""));
                      }}
                      className="w-full rounded-xl bg-[#0E1013] border border-white/10 px-4 py-3 text-white outline-none focus:border-cyan-500/50 transition-all font-mono tracking-widest text-center"
                    />

                    <button
                      type="button"
                      disabled={utr.length !== 12 || verifying}
                      onClick={verifyPayment}
                      className="mt-4 w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition-all uppercase tracking-wider text-xs"
                    >
                      {verifying ? "Verifying Transaction..." : "VERIFY PAYMENT"}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* PAYMENT SUCCESS */}
          {paymentStatus === "success" && (
            <div className="border border-emerald-500/30 bg-emerald-950/10 p-6 rounded-xl text-center">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-mono text-[10px] tracking-[0.25em] uppercase mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Payment Verified
              </div>
              <h3 className="text-xl font-light tracking-[0.1em] text-white uppercase mb-4">
                Payment Received
              </h3>

              {releasedKey ? (
                <>
                  <div
                    onClick={copyKey}
                    className="bg-[#050506] border border-white/[0.04] px-4 py-4 rounded-xl font-mono text-cyan-400 text-base font-bold tracking-wider break-all shadow-inner select-all cursor-pointer hover:border-cyan-500/20 transition-colors"
                  >
                    {releasedKey}
                  </div>
                  <p className="text-[10px] text-neutral-500 font-mono mt-3 uppercase tracking-wider">
                    Your key has been automatically copied
                  </p>
                  <button
                    onClick={copyKey}
                    className="mt-4 w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-[0.2em] py-3 rounded-xl transition-all"
                  >
                    COPY KEY
                  </button>
                </>
              ) : (
                <div className="bg-[#050506] border border-white/[0.04] px-4 py-4 rounded-xl font-mono text-cyan-400 text-xs tracking-wider">
                  Payment verified. Loading your product key...
                </div>
              )}
            </div>
          )}

          {/* EXPIRED */}
          {paymentStatus === "expired" && (
            <div className="border border-red-500/30 bg-red-950/10 p-6 rounded-xl text-center">
              <div className="text-red-400 font-bold text-xs uppercase tracking-widest mb-2">
                Payment Session Expired
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                This payment order has expired. Please return to the store and create a new order.
              </p>
              <button
                onClick={() => router.replace("/")}
                className="mt-5 w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-[0.2em] py-3 rounded-xl transition-all"
              >
                RETURN TO STORE
              </button>
            </div>
          )}

          {/* MISC OR PERSISTENT ERRORS */}
          {paymentStatus === "error" && !errorMessage && (
            <div className="border border-red-500/30 bg-red-950/10 p-6 rounded-xl text-center">
              <div className="text-red-400 font-bold text-xs uppercase tracking-widest mb-2">
                Payment Error
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Unable to process this payment order.
              </p>
              <button
                onClick={() => router.replace("/")}
                className="mt-5 w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-[0.2em] py-3 rounded-xl transition-all"
              >
                RETURN TO STORE
              </button>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="mt-6 flex items-center justify-between text-[9px] text-neutral-500 uppercase tracking-[0.18em] font-mono px-3">
          <span>Secure Payment Verification</span>
          <div className="flex items-center gap-2">
            <span>SSL</span>
            <span>•</span>
            <span>UPI</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UpiPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050506] text-cyan-400 flex items-center justify-center font-mono text-xs tracking-widest uppercase">
          Connecting to Gateway...
        </div>
      }
    >
      <UpiPaymentContent />
    </Suspense>
  );
}