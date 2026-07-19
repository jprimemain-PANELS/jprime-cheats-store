"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Copy,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  ArrowUpRight,
  KeyRound,
} from "lucide-react";

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
  const urgent = timeLeft <= 60 && timeLeft > 0;

  // Presentation-only step tracker — derived from existing state, no new logic
  const steps = ["Scan & Pay", "Verify", "Complete"];
  const activeStep = paymentStatus === "success" ? 2 : verifying ? 1 : 0;
  const showSteps = paymentStatus === "pending" || paymentStatus === "success";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050506] flex flex-col items-center justify-center gap-4">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-white/[0.08]" />
          <div className="jprime-spinner absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 border-r-cyan-400" />
        </div>
        <p className="text-cyan-400/80 font-mono text-[11px] tracking-[0.25em] uppercase">
          Connecting to payment gateway
        </p>
        <style jsx global>{`
          @keyframes jprime-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .jprime-spinner {
            animation: jprime-spin 0.9s linear infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#050506] text-[#F3F4F6] font-sans flex items-center justify-center p-4 sm:p-6 antialiased selection:bg-cyan-500 selection:text-black relative overflow-hidden">
      {/* GLOBAL KEYFRAMES */}
      <style jsx global>{`
        @keyframes jprime-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes jprime-dot-pulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes jprime-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes jprime-scale-in {
          from { opacity: 0; transform: scale(0.94); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes jprime-check-draw {
          from { stroke-dashoffset: 48; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes jprime-ring-draw {
          from { stroke-dashoffset: 175; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes jprime-glow-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.7; }
        }
        .jprime-spinner {
          animation: jprime-spin 0.9s linear infinite;
        }
        .jprime-dot {
          animation: jprime-dot-pulse 1.2s ease-in-out infinite;
        }
        .jprime-fade-up {
          animation: jprime-fade-up 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .jprime-scale-in {
          animation: jprime-scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .jprime-check-path {
          stroke-dasharray: 48;
          stroke-dashoffset: 48;
          animation: jprime-check-draw 0.5s 0.15s cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }
        .jprime-ring-path {
          stroke-dasharray: 175;
          stroke-dashoffset: 175;
          animation: jprime-ring-draw 0.6s cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }
        .jprime-glow {
          animation: jprime-glow-pulse 2.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .jprime-spinner, .jprime-dot, .jprime-fade-up, .jprime-scale-in,
          .jprime-check-path, .jprime-ring-path, .jprime-glow {
            animation: none !important;
          }
        }
      `}</style>

      {copyMessage && (
        <div className="jprime-fade-up fixed top-5 left-1/2 -translate-x-1/2 z-[100] bg-emerald-500 text-black px-4 py-2 rounded-lg font-bold shadow-lg text-xs tracking-wider uppercase text-center">
          {copyMessage}
        </div>
      )}

      {/* BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-tr from-[#08090a] via-[#050506] to-[#0d0f12]" />
        <div className="jprime-glow absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/[0.05] rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-[440px] relative z-10">
        <div className="jprime-fade-up bg-[#0A0B0D] border border-white/[0.06] rounded-2xl p-6 sm:p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.85)]">
          {/* HEADER */}
          <div className="flex flex-col items-center text-center mb-7">
            <span className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.3em] uppercase font-semibold text-cyan-400 mb-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure Checkout
            </span>
            <h2 className="text-2xl font-light tracking-[0.18em] uppercase text-white">
              JPRIME CHEATS
            </h2>
            <div className="h-[1px] w-16 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent mt-3.5" />
          </div>

          {/* STEP TRACKER */}
          {showSteps && (
            <div className="flex items-center justify-between mb-7 px-1">
              {steps.map((label, i) => (
                <React.Fragment key={label}>
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors duration-300 ${
                        i < activeStep
                          ? "bg-cyan-500 text-black"
                          : i === activeStep
                          ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/50"
                          : "bg-white/[0.04] text-neutral-600 border border-white/[0.06]"
                      }`}
                    >
                      {i < activeStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    <span
                      className={`text-[9px] uppercase tracking-wider ${
                        i <= activeStep ? "text-neutral-300" : "text-neutral-600"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`flex-1 h-[1.5px] mx-2 mb-4 rounded-full transition-colors duration-500 ${
                        i < activeStep ? "bg-cyan-500/60" : "bg-white/[0.06]"
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

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
          {errorMessage && !verifying && (
            <div className="jprime-fade-up mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono text-center leading-relaxed">
              {errorMessage}
            </div>
          )}

          {/* PENDING PAYMENT */}
          {paymentStatus === "pending" && (
            <>
              {verifying ? (
                /* VERIFYING LOADING STATE */
                <div className="jprime-fade-up border border-cyan-500/20 bg-cyan-500/[0.03] p-8 rounded-xl mb-6 flex flex-col items-center justify-center min-h-[280px]">
                  <div className="relative w-16 h-16 mb-6">
                    <div className="absolute inset-0 rounded-full border-2 border-white/[0.06]" />
                    <div className="jprime-spinner absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 border-r-cyan-400" />
                  </div>

                  <h3 className="text-sm font-medium tracking-[0.15em] uppercase text-white mb-2 text-center">
                    Verifying Transaction
                  </h3>
                  <p className="text-[11px] text-neutral-400 text-center leading-relaxed max-w-[260px] mb-5">
                    Please wait while we confirm your UTR with the payment network. This usually takes a few seconds.
                  </p>

                  <div className="flex items-center gap-1.5">
                    <span className="jprime-dot w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ animationDelay: "0s" }} />
                    <span className="jprime-dot w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ animationDelay: "0.2s" }} />
                    <span className="jprime-dot w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ animationDelay: "0.4s" }} />
                  </div>

                  <div className="mt-6 flex items-center gap-2 text-[9px] text-neutral-500 tracking-wider font-mono uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                    Do not close this window
                  </div>
                </div>
              ) : (
                <div className="jprime-fade-up bg-[#0E1013] border border-white/[0.04] p-5 rounded-xl mb-6 flex flex-col items-center">
                  {order?.qr_url ? (
                    <div className="jprime-scale-in relative w-full aspect-square max-w-[250px]">
                      {/* Decorative corner frame */}
                      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 border-t-2 border-l-2 border-cyan-500/60 rounded-tl-md" />
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 border-t-2 border-r-2 border-cyan-500/60 rounded-tr-md" />
                      <span className="absolute -bottom-1.5 -left-1.5 w-5 h-5 border-b-2 border-l-2 border-cyan-500/60 rounded-bl-md" />
                      <span className="absolute -bottom-1.5 -right-1.5 w-5 h-5 border-b-2 border-r-2 border-cyan-500/60 rounded-br-md" />
                      <div className="w-full h-full bg-white p-3 rounded-xl">
                        <img
                          src={order.qr_url}
                          alt="UPI Payment QR"
                          className="w-full h-full object-contain rounded-md"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full aspect-square max-w-[250px] bg-[#050506] border border-red-500/20 rounded-xl flex items-center justify-center text-red-400 text-xs text-center p-6">
                      QR code unavailable.
                    </div>
                  )}

                  <div className="mt-4 flex flex-col items-center gap-1">
                    <div
                      className={`flex items-center gap-1.5 text-base font-mono font-light tracking-[0.2em] transition-colors duration-300 ${
                        urgent ? "text-amber-400" : "text-cyan-400"
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {minutes}:{seconds}
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-neutral-500 tracking-wider font-mono uppercase">
                      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${urgent ? "bg-amber-500" : "bg-cyan-500"}`} />
                      Session Expiry Countdown
                    </div>
                  </div>
                </div>
              )}

              {!verifying && (
                <div className="jprime-fade-up space-y-3.5 mb-7 border-t border-b border-white/[0.05] py-4 px-0.5">
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
              )}

              {order?.upi_link && (
                <>
                  {!verifying && (
                    <a
                      href={order.upi_link}
                      className="group flex items-center justify-center gap-2 w-full bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-black font-bold text-xs uppercase tracking-[0.2em] py-4 rounded-xl transition-all duration-200 hover:shadow-[0_8px_24px_-6px_rgba(6,182,212,0.5)] active:scale-[0.98]"
                    >
                      Pay Now
                      <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </a>
                  )}

                  <div className="mt-6">
                    {!verifying && (
                      <>
                        <p className="text-xs text-neutral-400 mb-2">
                          Enter 12-digit UTR after payment
                        </p>

                        <div className="relative">
                          <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-600" />
                          <input
                            type="text"
                            placeholder="Enter UTR Number"
                            maxLength={12}
                            value={utr}
                            disabled={verifying}
                            onChange={(e) => {
                              setErrorMessage("");
                              setUtr(e.target.value.replace(/\D/g, ""));
                            }}
                            className="w-full rounded-xl bg-[#0E1013] border border-white/10 pl-10 pr-4 py-3 text-white outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/10 transition-all font-mono tracking-widest text-center disabled:opacity-40"
                          />
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      disabled={utr.length !== 12 || verifying}
                      onClick={verifyPayment}
                      className="mt-4 w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition-all uppercase tracking-wider text-xs flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Verifying Transaction...
                        </>
                      ) : (
                        "Verify Payment"
                      )}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* PAYMENT SUCCESS */}
          {paymentStatus === "success" && (
            <div className="jprime-fade-up border border-emerald-500/30 bg-emerald-950/10 p-6 rounded-xl text-center">
              <div className="jprime-scale-in w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <path
                    d="M5 13.5L10.5 19L21 7"
                    stroke="#34d399"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="jprime-check-path"
                  />
                </svg>
              </div>
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
                    className="mt-4 w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-[0.2em] py-3 rounded-xl transition-all active:scale-[0.98]"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy Key
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
            <div className="jprime-fade-up border border-red-500/30 bg-red-950/10 p-6 rounded-xl text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <Clock className="h-5 w-5 text-red-400" />
              </div>
              <div className="text-red-400 font-bold text-xs uppercase tracking-widest mb-2">
                Payment Session Expired
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                This payment order has expired. Please return to the store and create a new order.
              </p>
              <button
                onClick={() => router.replace("/")}
                className="mt-5 w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-[0.2em] py-3 rounded-xl transition-all active:scale-[0.98]"
              >
                Return To Store
              </button>
            </div>
          )}

          {/* MISC OR PERSISTENT ERRORS */}
          {paymentStatus === "error" && !errorMessage && (
            <div className="jprime-fade-up border border-red-500/30 bg-red-950/10 p-6 rounded-xl text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div className="text-red-400 font-bold text-xs uppercase tracking-widest mb-2">
                Payment Error
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Unable to process this payment order.
              </p>
              <button
                onClick={() => router.replace("/")}
                className="mt-5 w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-[0.2em] py-3 rounded-xl transition-all active:scale-[0.98]"
              >
                Return To Store
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