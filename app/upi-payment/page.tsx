"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function UpiPaymentContent() {
  const params = useSearchParams();
  const amount = params.get("amount") || "0.00";
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Backend parameters kept exactly the same
  const upiLink = `upi://pay?pa=7200817883@fam&pn=Jenith&am=${amount}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(upiLink)}&color=ffffff&bgcolor=0A0B0D`;

  const formatted = Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="min-h-screen w-full bg-[#050506] text-[#F3F4F6] font-sans flex items-center justify-center p-4 antialiased selection:bg-cyan-500 selection:text-black relative overflow-hidden">
      
      {/* ── CLASSIC METALLIC STEEL BACKGROUND SWEEP ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Subtle, cold-toned dark steel background gradients */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#08090a] via-[#050506] to-[#0d0f12]" />
        
        {/* Elegant sun reflection across steel plate */}
        <div 
          className="absolute -inset-[100%] opacity-15"
          style={{
            background: "linear-gradient(135deg, transparent 42%, rgba(255,255,255,0.01) 45%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.01) 55%, transparent 58%)",
            animation: "steel-glint 8s cubic-bezier(0.25, 1, 0.5, 1) infinite",
          }}
        />
        
        {/* Soft, premium ambient light anchor */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/[0.02] rounded-full blur-[140px]" />
      </div>

      {/* ── INTERFACE CARD ── */}
      <div
        className={`transition-all duration-700 ease-out ${
          isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-[0.99]"
        } w-full max-w-[440px] relative z-10`}
      >
        <div className="bg-[#0A0B0D] border border-white/[0.06] rounded-2xl p-6 sm:p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.85)]">
          
          {/* Company Brand Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <span className="text-[10px] tracking-[0.35em] uppercase font-semibold text-cyan-400 mb-1.5">
              Secure Checkout Protocol
            </span>
            <h2 className="text-2xl font-light tracking-[0.18em] uppercase text-white">
            JPRIME CHEATS
            </h2>
            <div className="h-[1px] w-16 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent mt-3.5" />
          </div>

          {/* Amount Display (Clean Corporate Typography) */}
          <div className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 text-center mb-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-1">Amount Due</p>
            <p className="text-4xl font-extralight tracking-tight text-white font-mono">
              ₹{formatted}
            </p>
          </div>

          {/* QR Code Segment */}
          <div className="bg-[#0E1013] border border-white/[0.04] p-5 rounded-xl mb-6 flex flex-col items-center">
            <div className="w-full aspect-square max-w-[250px] bg-[#0A0B0D] p-3 rounded-xl border border-white/[0.02]">
              <img
                src={qrUrl}
                alt="UPI QR Representation"
                className="w-full h-full rounded-md opacity-90 grayscale-[10%] contrast-[110%]"
              />
            </div>
            
            <div className="mt-4 flex items-center gap-2 text-[10px] text-neutral-400 tracking-wider font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Scan with any preferred UPI application
            </div>
          </div>

          {/* Professional Transaction Summary Ledger */}
          <div className="space-y-3.5 mb-7 border-t border-b border-white/[0.05] py-4.5 px-0.5">
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
              <span className="text-cyan-400 tracking-wider text-[11px] font-medium uppercase">
                Awaiting Payment
              </span>
            </div>
          </div>

          {/* Action Button (Solid True-Cyan Interactive State) */}
          <a
            href={upiLink}
            className="group relative flex items-center justify-center w-full bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-black font-bold text-xs uppercase tracking-[0.2em] py-4 rounded-xl transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          >
            PAY NOW
          </a>

        </div>

        {/* Secure Institutional Footer */}
        <div className="mt-6 flex items-center justify-between text-[9px] text-neutral-500 uppercase tracking-[0.18em] font-mono px-3">
          <span>End-to-End Encrypted</span>
          <div className="flex items-center gap-2">
            <span>SSL</span>
            <span>•</span>
            <span>PCI-DSS</span>
            <span>•</span>
            <span>UPI 2.0</span>
          </div>
        </div>

      </div>

      {/* ── HIGH PERFORMANCE COMPILER-SAFE ANIMATION KEYFRAMES ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes steel-glint {
          0% { transform: translate(-20%, -20%); opacity: 0; }
          5% { opacity: 0.15; }
          15% { opacity: 0.15; }
          25% { transform: translate(20%, 20%); opacity: 0; }
          100% { transform: translate(20%, 20%); opacity: 0; }
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