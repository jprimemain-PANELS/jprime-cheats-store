"use client";

import React, { useState, useEffect } from "react";

export default function RefundPolicyPage() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#050506] text-[#F3F4F6] font-sans flex flex-col items-center justify-between p-4 sm:p-8 antialiased selection:bg-cyan-500 selection:text-black relative overflow-hidden">
      
      {/* ── INTENSE AMBIENT GLOW BACKGROUND ELEMENTS ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Deep dark backdrop gradient base */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#050506] via-[#07080a] to-[#050506]" />
        
        {/* Center Radial Core Glow — directly positioning a heavy cyan aura behind the layout */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[800px] h-[500px] sm:h-[600px] bg-cyan-500/[0.08] rounded-full blur-[120px] sm:blur-[180px]" />
        
        {/* Subtle Side Edge Glows matching the ambient highlights from image_56a4fc.png */}
        <div className="absolute top-1/4 left-0 w-[300px] h-[400px] bg-cyan-600/[0.03] rounded-full blur-[130px] -translate-x-1/2" />
        <div className="absolute bottom-1/4 right-0 w-[300px] h-[400px] bg-cyan-400/[0.04] rounded-full blur-[130px] translate-x-1/2" />

        {/* Animated Refractive Metallic Glint */}
        <div 
          className="absolute -inset-[100%] opacity-20"
          style={{
            background: "linear-gradient(135deg, transparent 42%, rgba(255,255,255,0.01) 45%, rgba(6,182,212,0.15) 50%, rgba(255,255,255,0.01) 55%, transparent 58%)",
            animation: "steel-glint 9s cubic-bezier(0.25, 1, 0.5, 1) infinite",
          }}
        />
      </div>

      {/* ── CENTRAL REFUND POLICY CARD ── */}
      <div className={`flex-1 flex items-center justify-center w-full max-w-4xl relative z-10 transition-all duration-700 ease-out ${isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-[0.99]"}`}>
        
        <div className="bg-[#0A0B0D] border border-white/[0.06] hover:border-cyan-500/20 rounded-2xl p-6 sm:p-10 shadow-[0_0_50px_-12px_rgba(6,182,212,0.15),0_32px_64px_-16px_rgba(0,0,0,0.85)] transition-colors duration-500 w-full">
          
          {/* Header Typography Group */}
          <div className="flex flex-col items-center text-center mb-10">
            <span className="text-[10px] tracking-[0.35em] uppercase font-semibold text-cyan-400 mb-1.5 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">
              Legal Documentation
            </span>
            <h1 className="text-3xl font-light tracking-[0.18em] uppercase text-white">
              Refund Policy
            </h1>
            <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent mt-3.5" />
          </div>

          {/* Introductory Statements */}
          <div className="space-y-4 mb-8 border-b border-white/[0.05] pb-6">
            <p className="text-sm text-gray-300 font-light leading-relaxed">
              At JPRIME CHEATS, we provide digital products that are delivered automatically after successful payment confirmation.
            </p>
            <p className="text-sm text-gray-300 font-light leading-relaxed">
              Because digital products are delivered instantly and cannot be returned after delivery, all purchases are generally considered final.
            </p>
          </div>

          {/* ── POLICY SECTIONS ── */}
          <div className="space-y-8">

            {/* Before Purchasing */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 sm:p-6 hover:bg-cyan-950/[0.03] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h2 className="text-base font-semibold text-white tracking-wide">
                  Before Purchasing
                </h2>
              </div>
              <ul className="list-disc pl-6 text-gray-300 space-y-2 text-sm font-light">
                <li>Select the correct product and duration.</li>
                <li>Review the product details carefully.</li>
                <li>Ensure your device meets the requirements.</li>
                <li>Understand the features included with your purchase.</li>
              </ul>
            </section>

            {/* Refund Eligibility */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 sm:p-6 hover:bg-cyan-950/[0.03] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h2 className="text-base font-semibold text-white tracking-wide">
                  Refund Eligibility
                </h2>
              </div>
              <p className="text-gray-300 mb-4 text-sm font-light">
                Refunds may only be considered in the following situations:
              </p>
              <ul className="list-disc pl-6 text-gray-300 space-y-2 text-sm font-light">
                <li>Duplicate payment for the same order.</li>
                <li>Product key was not delivered due to a verified system issue.</li>
                <li>Payment was successful but the order was not processed.</li>
              </ul>
              <p className="text-gray-300 mt-4 text-sm font-light">
                All refund requests are reviewed individually by our support team.
              </p>
            </section>

            {/* Support Assistance */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h2 className="text-base font-semibold text-white tracking-wide">
                  Support Assistance
                </h2>
              </div>
              <p className="text-gray-300 text-sm font-light leading-relaxed">
                If you experience any issue with your purchase, our team is available to assist you. Most issues can be resolved quickly through technical support.
              </p>
            </section>

            {/* Contact Support */}
            <section className="bg-[#0E1013] border border-cyan-500/[0.08] p-5 sm:p-6 rounded-xl shadow-[0_0_24px_-12px_rgba(6,182,212,0.1)]">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h2 className="text-base font-semibold text-white tracking-wide">
                  Contact Support
                </h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-300">
                <div className="bg-[#050506] border border-white/[0.03] p-4 rounded-xl flex items-center justify-between font-mono text-xs hover:border-cyan-500/20 transition-all duration-300">
                  <span className="text-neutral-500">Telegram:</span>
                  <a
                    href="https://t.me/JPRIMEADMIN"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline font-bold drop-shadow-[0_0_4px_rgba(34,211,238,0.2)]"
                  >
                    @JPRIMEADMIN
                  </a>
                </div>
                
                <div className="bg-[#050506] border border-white/[0.03] p-4 rounded-xl flex items-center justify-between font-mono text-xs hover:border-cyan-500/20 transition-all duration-300">
                  <span className="text-neutral-500">Website:</span>
                  <a
                    href="https://www.jprimecheats.store"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline font-bold drop-shadow-[0_0_4px_rgba(34,211,238,0.2)]"
                  >
                    www.jprimecheats.store
                  </a>
                </div>
              </div>
              
              <p className="text-xs text-center text-neutral-400 font-mono mt-4 uppercase tracking-wider">
                Support Response Time: Usually within 24 hours.
              </p>
            </section>

            {/* Policy Acceptance */}
            <section className="border-t border-white/[0.05] pt-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <h2 className="text-xs uppercase tracking-[0.15em] font-semibold text-neutral-400">
                  Policy Acceptance
                </h2>
              </div>
              <p className="text-xs text-gray-400 font-light max-w-2xl mx-auto leading-relaxed">
                By completing a purchase on JPRIME CHEATS, you acknowledge that you have read and accepted this Refund Policy.
              </p>
            </section>

          </div>

        </div>

      </div>

      {/* ── FULL-WIDTH FOOTER SYSTEM PLACED RIGIDLY AT THE BOTTOM ── */}
      <div className={`w-full max-w-4xl mt-12 relative z-10 transition-opacity duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}>
        <div className="flex items-center justify-between text-[9px] text-neutral-500 uppercase tracking-[0.18em] font-mono px-3 border-t border-white/[0.03] pt-4 pb-2">
          <span>End-to-End Encrypted</span>
          <div className="flex items-center gap-2">
            <span>SSL</span><span>•</span><span>PCI-DSS</span><span>•</span><span>COMPLIANCE</span>
          </div>
        </div>
      </div>

      {/* ── STYLE BLOCKS FOR ANIMATED GLINT MATRIX ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes steel-glint {
          0% { transform: translate(-20%, -20%); opacity: 0; }
          5% { opacity: 0.2; }
          15% { opacity: 0.2; }
          25% { transform: translate(20%, 20%); opacity: 0; }
          100% { transform: translate(20%, 20%); opacity: 0; }
        }
      `}} />
    </div>
  );
}