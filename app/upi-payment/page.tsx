"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; 

function UpiPaymentContent() {
  const params = useSearchParams();
  const router = useRouter();
  const amount = params.get("amount") || "0.00";
  const username = params.get("username") || ""; 
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "success">("pending");
  const [releasedKey, setReleasedKey] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  
  // Strict Row Tracking State for targeted duplicate protection mutations
  const [paymentId, setPaymentId] = useState<number | null>(null);
  
  // ── TIMER STATES ──
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [isExpired, setIsExpired] = useState(false);

  // Centralized tracking identifiers matching your original build
  const viewedKey = `order_completed_${username}_${amount}`;
  const expiredKey = `payment_expired_${username}_${amount}`;

  // Smooth fade-in UI load trigger
  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(t);
  }, []);

  // ── REDIRECTION GUARD: BLOCK EXPIRED & ALREADY USED ORDERS IMMEDIATELY ──
  useEffect(() => {
    if (!amount || amount === "0.00" || !username) return;

    if (localStorage.getItem(expiredKey) === "true") {
      router.replace("/");
      return;
    }

    const checkExistingOrder = async () => {
      const { data, error } = await supabase
        .from("payment_orders")
        .select("id, status, used, product_name, duration")
        .eq("username", username)
        .eq("amount", amount)
        .order("id", { ascending: false }) // Target the newest row
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        // Cache the specific database row ID immediately onto local component state
        setPaymentId(data.id);

        // DUPLICATE PROTECTION CRITERIA: If order succeeded and was already claimed, reject entry
        if (data.status === "success" && data.used === true) {
          router.replace("/");
          return;
        }

        if (data.status === "success" && !data.used) {
          const isAlreadyViewed = localStorage.getItem(viewedKey);
          
          if (isAlreadyViewed === "true") {
            router.replace("/");
          } else {
            setPaymentStatus("success");
            
            const { data: historyData, error: historyError } = await supabase
              .from("purchase_history")
              .select("key_code")
              .eq("username", username)
              .eq("product_name", data.product_name) 
              .eq("duration", data.duration)         
              .order("id", { ascending: false })
              .limit(1)
              .single();

            if (!historyError && historyData) {
              setReleasedKey(historyData.key_code);
            }
          }
        }
      }
    };

    checkExistingOrder();
  }, [username, amount, router, viewedKey, expiredKey]);

  // ── 5-MINUTE TIMEOUT PROTOCOL ──
  useEffect(() => {
    if (paymentStatus === "success" || isExpired) return;

    const countdown = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdown);
          setIsExpired(true);
          localStorage.setItem(expiredKey, "true");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [paymentStatus, isExpired, expiredKey]);

  // ── EXPIRED AUTO-REDIRECT ENGINE (5 SECONDS) ──
  useEffect(() => {
    if (!isExpired) return;

    const homeRedirectTimer = setTimeout(() => {
      router.replace("/");
    }, 5000);

    return () => clearTimeout(homeRedirectTimer);
  }, [isExpired, router]);

  // ── KEY DELIVERED: SECURE TARGETED ROW INVALIDATION PROTOCOL ──
  useEffect(() => {
    if (!releasedKey) return;
  
    navigator.clipboard.writeText(releasedKey)
      .then(() => {
        setCopyMessage("✅ Key copied to clipboard!");
      })
      .catch(() => {
        setCopyMessage("⚠️ Copy failed. Use COPY KEY button.");
      });
  
    const msgTimer = setTimeout(() => {
      setCopyMessage("");
    }, 8000);

    // Flag payload execution using targeted paymentId bounds
    const markOrderAsUsed = async () => {
      localStorage.setItem(viewedKey, "true");
      
      if (paymentId) {
        await supabase
          .from("payment_orders")
          .update({ used: true })
          .eq("id", paymentId); // Strictly update only this specific row
      } else {
        // Safe robust fallback query array if row sequence ID extraction hasn't resolved locally yet
        await supabase
          .from("payment_orders")
          .update({ used: true })
          .eq("username", username)
          .eq("amount", amount)
          .eq("status", "success");
      }
    };

    markOrderAsUsed();

    const redirectTimer = setTimeout(() => {
      router.replace("/");
    }, 5000);
  
    return () => {
      clearTimeout(msgTimer);
      clearTimeout(redirectTimer);
    };
  }, [releasedKey, paymentId, username, amount, router, viewedKey]);

  // ── MANUAL COPY HANDLER ──
  const copyKey = async () => {
    if (!releasedKey) return;
    try {
      await navigator.clipboard.writeText(releasedKey);
      setCopyMessage("✅ Key copied to clipboard!");
    } catch {
      setCopyMessage("⚠️ Copy failed. Use COPY KEY button.");
    } finally {
      setTimeout(() => {
        setCopyMessage("");
      }, 8000);
    }
  };

  // ── REALTIME SUBSCRIPTION WITH TARGETED ROW IDENTIFICATION EXTRACTION ──
  useEffect(() => {
    if (!amount || amount === "0.00" || !username || isExpired) return;

    const channel = supabase
      .channel(`live-payment-unfiltered-${amount}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "payment_orders"
        },
        async (payload) => {
          const dbId = payload.new?.id;
          const dbStatus = payload.new?.status;
          const dbUsed = payload.new?.used;
          const dbUsername = payload.new?.username;
          const dbAmount = payload.new?.amount;
          const dbProductName = payload.new?.product_name;
          const dbDuration = payload.new?.duration;

          // DUPLICATE PROTECTION: Completely ignore updates if the order row is marked used
          if (dbUsed === true) return;

          if (
            paymentStatus !== "success" &&
            dbStatus === "success" && 
            String(dbUsername) === String(username) && 
            String(dbAmount) === String(amount)
          ) {
            // Isolate and trap the exact database row identifier from incoming transaction payloads
            if (dbId) setPaymentId(dbId);
            
            setPaymentStatus("success");

            const { data, error } = await supabase
              .from("purchase_history")
              .select("key_code")
              .eq("username", username)
              .eq("product_name", dbProductName)
              .eq("duration", dbDuration)
              .order("id", { ascending: false })
              .limit(1)
              .single();

            if (!error && data) {
              setReleasedKey(data.key_code);
            }
          }
        }
      );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [username, amount, paymentStatus, isExpired]);

  const upiLink = `upi://pay?pa=7200817883@fam&pn=Jenith&am=${amount}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(upiLink)}&color=ffffff&bgcolor=0A0B0D`;

  const formatted = Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const seconds = String(timeLeft % 60).padStart(2, "0");

  return (
    <div className="min-h-screen w-full bg-[#050506] text-[#F3F4F6] font-sans flex items-center justify-center p-4 antialiased selection:bg-cyan-500 selection:text-black relative z-0 overflow-hidden">
      
      {/* FLOATING VALIDATION NOTIFICATION POPUP */}
      {copyMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] bg-emerald-500 text-black px-4 py-2 rounded-lg font-bold shadow-lg text-xs tracking-wider uppercase">
          {copyMessage}
        </div>
      )}

      {/* BACKGROUND EFFECTS */}
      <div className="absolute inset-0 pointer-events-none -z-20" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-tr from-[#08090a] via-[#050506] to-[#0d0f12]" />
        <div 
          className="absolute -inset-[100%] opacity-15 -z-10"
          style={{
            background: "linear-gradient(135deg, transparent 42%, rgba(255,255,255,0.01) 45%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.01) 55%, transparent 58%)",
            animation: "steel-glint 8s cubic-bezier(0.25, 1, 0.5, 1) infinite",
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/[0.02] rounded-full blur-[140px] -z-10" />
      </div>

      {/* CORE DISPLAY CARD */}
      <div className={`transition-all duration-700 ease-out ${isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-[0.99]"} w-full max-w-[440px] relative z-10`}>
        <div className="bg-[#0A0B0D] border border-white/[0.06] rounded-2xl p-6 sm:p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.85)] relative z-20">
          
          <div className="flex flex-col items-center text-center mb-8 relative z-30">
            <span className="text-[10px] tracking-[0.35em] uppercase font-semibold text-cyan-400 mb-1.5">
              Secure Checkout Protocol
            </span>
            <h2 className="text-2xl font-light tracking-[0.18em] uppercase text-white">
              JPRIME CHEATS
            </h2>
            <div className="h-[1px] w-16 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent mt-3.5" />
          </div>

          <div className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 text-center mb-6 relative z-30">
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-1">Amount Due</p>
            <p className="text-4xl font-extralight tracking-tight text-white font-mono">
              ₹{formatted}
            </p>
          </div>

          {paymentStatus === "pending" ? (
            <>
              <div className="bg-[#0E1013] border border-white/[0.04] p-5 rounded-xl mb-6 flex flex-col items-center relative overflow-hidden z-30">
                <div className={`w-full aspect-square max-w-[250px] bg-[#0A0B0D] p-3 rounded-xl border border-white/[0.02] transition-all duration-500 ${isExpired ? "blur-md opacity-30 scale-95 select-none pointer-events-none" : "opacity-90"} relative z-10`}>
                  <img src={qrUrl} alt="UPI QR Representation" className="w-full h-full rounded-md grayscale-[10%] contrast-[110%]" />
                </div>
                
                {isExpired && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-black/40 backdrop-blur-sm z-40 animate-fadeIn">
                    <div className="bg-red-500/10 border border-red-500/30 px-4 py-3 rounded-xl text-center shadow-lg max-w-[85%]">
                      <div className="text-red-500 font-bold text-xs uppercase tracking-widest mb-1">
                        ⚠ Payment Session Expired
                      </div>
                      <p className="text-[9px] text-neutral-400 font-mono uppercase tracking-wider">
                        Returning to system index in 5s...
                      </p>
                    </div>
                  </div>
                )}

                {!isExpired ? (
                  <div className="mt-4 flex flex-col items-center gap-1 relative z-10">
                    <div className="text-base font-mono font-light tracking-[0.2em] text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.25)]">
                      {minutes}:{seconds}
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-neutral-500 tracking-wider font-mono uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                      Session Expiry Countdown
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-base font-mono font-light tracking-[0.2em] text-red-500/40 select-none relative z-10">
                    00:00
                  </div>
                )}
              </div>

              <div className="space-y-3.5 mb-7 border-t border-b border-white/[0.05] py-4.5 px-0.5 relative z-30">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400 tracking-wide">Merchant</span>
                  <span className="font-medium text-neutral-200 tracking-wide">JPrime cheats</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400 tracking-wide">Network</span>
                  <span className="font-mono text-neutral-300 text-[11px]">UPI.INSTANT.SECURE</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400 tracking-wide">Status</span>
                  <span className={`tracking-wider text-[11px] font-medium uppercase ${isExpired ? "text-red-500" : "text-cyan-400 animate-pulse"}`}>
                    {isExpired ? "Session Terminated" : "Awaiting Payment"}
                  </span>
                </div>
              </div>

              {!isExpired && (
                <a href={upiLink} className="group relative flex items-center justify-center w-full bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-black font-bold text-xs uppercase tracking-[0.2em] py-4 rounded-xl transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-cyan-400 z-30 shadow-[0_4px_20px_rgba(6,182,212,0.15)]">
                  PAY NOW
                </a>
              )}
            </>
          ) : (
            <div className="border border-emerald-500/30 bg-emerald-950/10 p-6 rounded-xl text-center shadow-[inset_0_1px_20px_rgba(16,185,129,0.05)] relative z-30 animate-fadeIn">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-mono text-[10px] tracking-[0.25em] uppercase mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <h4 className="inline">Authentication Complete</h4>
              </div>
              <h3 className="text-xl font-light tracking-[0.1em] text-white uppercase mb-4">
                Payment Received
              </h3>
              
              <div 
                onClick={copyKey}
                className="bg-[#050506] border border-white/[0.04] px-4 py-4 rounded-xl font-mono text-cyan-400 text-base font-bold tracking-wider break-all shadow-inner select-all cursor-pointer hover:border-cyan-500/20 transition-colors"
              >
                {releasedKey || "DECRYPTING KEY..."}
              </div>
              
              <p className="text-[10px] text-neutral-500 font-mono mt-3 uppercase tracking-wider">
                Click inside box to select and copy token
              </p>

              <button
                onClick={copyKey}
                className="mt-4 w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-[0.2em] py-3 rounded-xl transition-all shadow-md active:scale-[0.98]"
              >
                COPY KEY
              </button>
            </div>
          )}

        </div>

        <div className="mt-6 flex items-center justify-between text-[9px] text-neutral-500 uppercase tracking-[0.18em] font-mono px-3 relative z-20">
          <span>End-to-End Encrypted</span>
          <div className="flex items-center gap-2">
            <span>SSL</span><span>•</span><span>PCI-DSS</span><span>•</span><span>UPI 2.0</span>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes steel-glint {
          0% { transform: translate(-20%, -20%); opacity: 0; }
          5% { opacity: 0.15; }
          15% { opacity: 0.15; }
          25% { transform: translate(20%, 20%); opacity: 0; }
          100% { transform: translate(20%, 20%); opacity: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />
    </div>
  );
}

export default function UpiPaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050506] text-cyan-400 flex items-center justify-center font-mono text-xs tracking-widest uppercase">
        Connecting to Gateway...
      </div>
    }>
      <UpiPaymentContent />
    </Suspense>
  );
}