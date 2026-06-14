"use client";

import React, { useState, useEffect } from "react";

export default function PrivacyPolicyPage() {
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

      {/* ── CENTRAL PRIVACY POLICY CARD ── */}
      <div className={`flex-1 flex items-center justify-center w-full max-w-4xl relative z-10 transition-all duration-700 ease-out ${isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-[0.99]"}`}>
        
        <div className="bg-[#0A0B0D] border border-white/[0.06] hover:border-cyan-500/20 rounded-2xl p-6 sm:p-10 shadow-[0_0_50px_-12px_rgba(6,182,212,0.15),0_32px_64px_-16px_rgba(0,0,0,0.85)] transition-colors duration-500 w-full">
          
          {/* Header Typography Group */}
          <div className="flex flex-col items-center text-center mb-10">
            <span className="text-[10px] tracking-[0.35em] uppercase font-semibold text-cyan-400 mb-1.5 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">
              Legal Documentation
            </span>
            <h1 className="text-3xl font-light tracking-[0.18em] uppercase text-white">
              Privacy Policy
            </h1>
            <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent mt-3.5" />
          </div>

          {/* Core Introduction Framework */}
          <div className="space-y-4 mb-8 border-b border-white/[0.05] pb-6">
            <h2 className="text-lg font-light text-white uppercase tracking-wider text-center sm:text-left">
              JPRIME CHEATS
            </h2>
            <p className="text-sm text-gray-300 font-light leading-relaxed">
              At JPRIME CHEATS, we respect your privacy and are committed to protecting your personal information.
            </p>
          </div>

          {/* ── POLICY DISCLOSURE SECTIONS ── */}
          <div className="space-y-6">

            {/* 1. Information We Collect */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 hover:bg-cyan-950/[0.02] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  1. Information We Collect
                </h3>
              </div>
              <p className="text-gray-300 mb-3 text-sm font-light">
                We may collect limited information required to process orders and provide support, including:
              </p>
              <ul className="list-disc pl-6 text-gray-300 space-y-1.5 text-sm font-light">
                <li>Username</li>
                <li>Email address (if provided)</li>
                <li>Purchase information</li>
                <li>Payment confirmation details</li>
                <li>Support messages</li>
              </ul>
              <p className="text-gray-300 mt-3 text-sm font-light">
                We only collect information necessary to deliver our services.
              </p>
            </section>

            {/* 2. Main ID & Panel User Privacy */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 hover:bg-cyan-950/[0.02] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  2. Main ID & Panel User Privacy
                </h3>
              </div>
              <p className="text-gray-300 mb-3 text-sm font-light">
                If you use any JPRIME CHEATS product, including Main ID Panels, your privacy remains protected.
              </p>
              <p className="text-gray-300 mb-2 text-sm font-light">
                We do NOT:
              </p>
              <ul className="list-disc pl-6 text-gray-300 space-y-1.5 text-sm font-light">
                <li>Share your account information</li>
                <li>Share your gameplay activity</li>
                <li>Share your rankings or achievements</li>
                <li>Sell customer information</li>
                <li>Provide customer data to third parties</li>
              </ul>
              <p className="text-gray-300 mt-3 text-sm font-light">
                Your information remains private within our system.
              </p>
            </section>

            {/* 3. How We Use Information */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 hover:bg-cyan-950/[0.02] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  3. How We Use Information
                </h3>
              </div>
              <p className="text-gray-300 mb-3 text-sm font-light">
                We use collected information to:
              </p>
              <ul className="list-disc pl-6 text-gray-300 space-y-1.5 text-sm font-light">
                <li>Process purchases</li>
                <li>Deliver license keys</li>
                <li>Verify payments</li>
                <li>Provide customer support</li>
                <li>Improve our services</li>
                <li>Prevent fraudulent transactions</li>
              </ul>
            </section>

            {/* 4. Information Security */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 hover:bg-cyan-950/[0.02] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  4. Information Security
                </h3>
              </div>
              <p className="text-sm text-gray-300 font-light leading-relaxed">
                We use reasonable security measures to protect customer information. While no online system can guarantee absolute security, we continuously work to keep your information safe.
              </p>
            </section>

            {/* 5. Cookies & Website Analytics */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 hover:bg-cyan-950/[0.02] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  5. Cookies & Website Analytics
                </h3>
              </div>
              <p className="text-sm text-gray-300 font-light leading-relaxed">
                Our website may use cookies and basic analytics tools to improve website performance and user experience. These tools help us understand website traffic and improve service quality.
              </p>
            </section>

            {/* 6. Third-Party Services */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 hover:bg-cyan-950/[0.02] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  6. Third-Party Services
                </h3>
              </div>
              <p className="text-sm text-gray-300 font-light leading-relaxed">
                Payments may be processed through trusted payment providers. These providers operate under their own privacy policies and security standards.
              </p>
            </section>

            {/* 7. Policy Updates */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 hover:bg-cyan-950/[0.02] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  7. Policy Updates
                </h3>
              </div>
              <p className="text-sm text-gray-300 font-light leading-relaxed">
                This Privacy Policy may be updated occasionally to reflect service improvements or legal requirements. Updates will be published on this page.
              </p>
            </section>

            {/* 8. Contact Us Node */}
            <section className="bg-[#0E1013] border border-cyan-500/[0.08] p-5 sm:p-6 rounded-xl shadow-[0_0_24px_-12px_rgba(6,182,212,0.1)]">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-base font-semibold text-white tracking-wide">
                  8. Contact Us
                </h3>
              </div>
              
              <div className="mb-2 text-sm text-white font-medium">
                JPRIME CHEATS
              </div>
              
              <p className="text-xs text-neutral-400 mb-4 font-light">
                Support is available through Telegram support.
              </p>

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