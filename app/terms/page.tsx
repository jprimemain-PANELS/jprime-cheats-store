"use client";

import { OwnerOnly } from "@/components/owner-only";

import React, { useState, useEffect } from "react";

export default function TermsAndConditionsPage() {
  return (
    <OwnerOnly>
      <TermsAndConditionsPageContent />
    </OwnerOnly>
  );
}

function TermsAndConditionsPageContent() {
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
        
        {/* Center Radial Core Glow — positioning a heavy cyan aura behind the layout */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[800px] h-[500px] sm:h-[600px] bg-cyan-500/[0.08] rounded-full blur-[120px] sm:blur-[180px]" />
        
        {/* Subtle Side Edge Glows matching ambient highlights */}
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

      {/* ── CENTRAL TERMS & CONDITIONS CARD ── */}
      <div className={`flex-1 flex items-center justify-center w-full max-w-4xl relative z-10 transition-all duration-700 ease-out ${isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-[0.99]"}`}>
        
        <div className="bg-[#0A0B0D] border border-white/[0.06] hover:border-cyan-500/20 rounded-2xl p-6 sm:p-10 shadow-[0_0_50px_-12px_rgba(6,182,212,0.15),0_32px_64px_-16px_rgba(0,0,0,0.85)] transition-colors duration-500 w-full">
          
          {/* Header Typography Group */}
          <div className="flex flex-col items-center text-center mb-10">
            <span className="text-[10px] tracking-[0.35em] uppercase font-semibold text-cyan-400 mb-1.5 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">
              Legal Documentation
            </span>
            <h1 className="text-3xl font-light tracking-[0.18em] uppercase text-white">
              Terms & Conditions
            </h1>
            <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent mt-3.5" />
          </div>

          {/* Welcome Statements */}
          <div className="space-y-4 mb-8 border-b border-white/[0.05] pb-6">
            <h2 className="text-lg font-light text-white uppercase tracking-wider text-center sm:text-left">
              Welcome to JPRIME CHEATS
            </h2>
            <p className="text-sm text-gray-300 font-light leading-relaxed">
              These Terms & Conditions govern your use of JPRIME CHEATS and our services. By accessing our website or purchasing any product, you agree to these terms.
            </p>
          </div>

          {/* ── CLAUSES SECTIONS ── */}
          <div className="space-y-6">

            {/* 1. About Our Services */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 hover:bg-cyan-950/[0.02] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  1. About Our Services
                </h3>
              </div>
              <p className="text-sm text-gray-300 font-light leading-relaxed">
                JPRIME CHEATS provides digital products and software licenses through our website. All products are delivered digitally after successful payment confirmation.
              </p>
            </section>

            {/* 2. User Requirements */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 hover:bg-cyan-950/[0.02] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  2. User Requirements
                </h3>
              </div>
              <p className="text-gray-300 mb-3 text-sm font-light">
                By using our services, you confirm that:
              </p>
              <ul className="list-disc pl-6 text-gray-300 space-y-1.5 text-sm font-light">
                <li>The information you provide is accurate.</li>
                <li>You are responsible for your account and purchase details.</li>
                <li>You will use our website lawfully and responsibly.</li>
                <li>You understand the product information before purchasing.</li>
              </ul>
            </section>

            {/* 3. Products & Pricing */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 hover:bg-cyan-950/[0.02] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  3. Products & Pricing
                </h3>
              </div>
              <ul className="list-disc pl-6 text-gray-300 space-y-1.5 text-sm font-light">
                <li>Product availability may change at any time.</li>
                <li>Prices may be updated without prior notice.</li>
                <li>We reserve the right to modify, update, or discontinue products when necessary.</li>
              </ul>
            </section>

            {/* 4. Payments */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 hover:bg-cyan-950/[0.02] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  4. Payments
                </h3>
              </div>
              <ul className="list-disc pl-6 text-gray-300 space-y-1.5 text-sm font-light">
                <li>We accept supported payment methods displayed on our website.</li>
                <li>By making a purchase, you authorize payment for the selected product and duration.</li>
                <li>Orders are processed automatically after payment confirmation.</li>
              </ul>
            </section>

            {/* 5. Refund Policy */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 hover:bg-cyan-950/[0.02] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  5. Refund Policy
                </h3>
              </div>
              <p className="text-sm text-gray-300 font-light leading-relaxed">
                Please refer to our Refund Policy page for complete refund information. Digital products are delivered instantly after payment confirmation, and refund eligibility is reviewed according to our Refund Policy.
              </p>
            </section>

            {/* 6. Support */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 hover:bg-cyan-950/[0.02] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  6. Support
                </h3>
              </div>
              <p className="text-sm text-gray-300 font-light leading-relaxed mb-3">
                If you experience any issues with your purchase, our support team will assist you as quickly as possible.
              </p>
              <div className="text-xs font-mono text-gray-300 space-y-1 bg-[#050506] border border-white/[0.02] p-3 rounded-lg max-w-sm">
                <div>Support Contact:</div>
                <div>Telegram: <a href="https://t.me/JPRIMEADMIN" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">@JPRIMEADMIN</a></div>
                <div>Website: <a href="https://www.jprimecheats.store" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">https://www.jprimecheats.store</a></div>
              </div>
            </section>

            {/* 7. Intellectual Property */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 hover:bg-cyan-950/[0.02] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  7. Intellectual Property
                </h3>
              </div>
              <p className="text-sm text-gray-300 font-light leading-relaxed">
                All website content, branding, logos, designs, software, and digital materials belong to JPRIME CHEATS and may not be copied, redistributed, or reproduced without permission.
              </p>
            </section>

            {/* 8. Service Availability */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 hover:bg-cyan-950/[0.02] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  8. Service Availability
                </h3>
              </div>
              <p className="text-sm text-gray-300 font-light leading-relaxed">
                We strive to keep our services available at all times. However, temporary interruptions may occur due to maintenance, updates, or technical issues.
              </p>
            </section>

            {/* 9. Limitation of Liability */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 hover:bg-cyan-950/[0.02] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  9. Limitation of Liability
                </h3>
              </div>
              <ul className="list-disc pl-6 text-gray-300 space-y-1.5 text-sm font-light">
                <li>JPRIME CHEATS shall not be responsible for indirect, incidental, or consequential damages arising from the use of our products or services.</li>
                <li>Users are responsible for ensuring their device meets the required specifications before purchase.</li>
              </ul>
            </section>

            {/* 10. Changes to Terms */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 hover:bg-cyan-950/[0.02] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  10. Changes to Terms
                </h3>
              </div>
              <p className="text-sm text-gray-300 font-light leading-relaxed">
                We may update these Terms & Conditions from time to time. Continued use of our services after updates means you accept the revised terms.
              </p>
            </section>

            {/* 11. Contact Information Framework node */}
            <section className="bg-[#0E1013] border border-cyan-500/[0.08] p-5 sm:p-6 rounded-xl shadow-[0_0_24px_-12px_rgba(6,182,212,0.1)]">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-base font-semibold text-white tracking-wide">
                  11. Contact Information
                </h3>
              </div>
              
              <div className="mb-4 text-sm text-white font-medium">
                JPRIME CHEATS
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
                    https://t.me/JPRIMEADMIN
                  </a>
                </div>
                
                <div className="bg-[#050506] border border-white/[0.03] p-4 rounded-xl flex items-center justify-between font-mono text-xs hover:border-cyan-500/20 transition-all duration-300">
                  <span className="text-neutral-500">Official Website:</span>
                  <a
                    href="https://www.jprimecheats.store"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline font-bold drop-shadow-[0_0_4px_rgba(34,211,238,0.2)]"
                  >
                    https://www.jprimecheats.store
                  </a>
                </div>
              </div>
              
              <p className="text-xs text-center text-neutral-500 font-mono mt-4 uppercase tracking-widest">
                Last Updated: June 2026
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