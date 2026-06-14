"use client";

import React, { useState, useEffect } from "react";

export default function OfficialPlatformsPage() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#050506] text-[#F3F4F6] font-sans flex flex-col items-center justify-between p-4 sm:p-8 antialiased selection:bg-cyan-500 selection:text-black relative overflow-hidden">
      
      {/* ── INTENSE AMBIENT GLOW BACKGROUND ELEMENTS ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-tr from-[#050506] via-[#07080a] to-[#050506]" />
        
        {/* Center Radial Core Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[800px] h-[500px] sm:h-[600px] bg-cyan-500/[0.08] rounded-full blur-[120px] sm:blur-[180px]" />
        
        {/* Subtle Side Edge Glows */}
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

      {/* ── CENTRAL OFFICIAL PLATFORMS CARD ── */}
      <div className={`flex-1 flex items-center justify-center w-full max-w-4xl relative z-10 transition-all duration-700 ease-out ${isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-[0.99]"}`}>
        
        <div className="bg-[#0A0B0D] border border-white/[0.06] hover:border-cyan-500/20 rounded-2xl p-6 sm:p-10 shadow-[0_0_50px_-12px_rgba(6,182,212,0.15),0_32px_64px_-16px_rgba(0,0,0,0.85)] transition-colors duration-500 w-full">
          
          {/* Header Typography Group */}
          <div className="flex flex-col items-center text-center mb-10">
            <span className="text-[10px] tracking-[0.35em] uppercase font-semibold text-cyan-400 mb-1.5 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">
              Verified Ecosystem
            </span>
            <h1 className="text-3xl font-light tracking-[0.18em] uppercase text-white">
              Official Platforms
            </h1>
            <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent mt-3.5" />
          </div>

          {/* Welcome Statements */}
          <div className="space-y-3 mb-8 border-b border-white/[0.05] pb-6 text-center sm:text-left">
            <h2 className="text-lg font-light text-white uppercase tracking-wider">
              Welcome to JPRIME CHEATS
            </h2>
            <p className="text-sm text-gray-300 font-light leading-relaxed">
              Stay connected with our official platforms for updates, announcements, support, and community access.
            </p>
          </div>

          {/* ── CORE HUBS MATRIX ── */}
          <div className="space-y-8">
            
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  Official Links
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* YouTube */}
                <a href="https://youtube.com/@jprimepanel" target="_blank" rel="noopener noreferrer" className="bg-white/[0.01] border border-white/[0.03] p-4 rounded-xl flex items-center gap-4 hover:bg-red-950/[0.04] hover:border-red-500/30 transition-all duration-300 group">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-white tracking-wider group-hover:text-red-400 transition-colors">YouTube Channel</div>
                    <div className="text-xs font-mono text-neutral-500 truncate max-w-[240px] sm:max-w-none">@jprimepanel</div>
                  </div>
                </a>

                {/* Telegram Channel */}
                <a href="https://t.me/+I1xgddUrExBlN2U1" target="_blank" rel="noopener noreferrer" className="bg-white/[0.01] border border-white/[0.03] p-4 rounded-xl flex items-center gap-4 hover:bg-sky-950/[0.04] hover:border-sky-500/30 transition-all duration-300 group">
                  <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M11.944 0C5.344 0 0 5.344 0 11.944c0 5.622 3.88 10.33 9.122 11.637-.1-.99-.188-2.516.04-3.6l1.378-5.836s-.35-.7-.35-1.736c0-1.626.942-2.84 2.116-2.84 1 0 1.482.75 1.482 1.65 0 1.004-.64 2.508-.97 3.898-.275 1.164.586 2.113 1.734 2.113 2.08 0 3.682-2.194 3.682-5.36 0-2.8-2.013-4.76-4.89-4.76-3.328 0-5.284 2.496-5.284 5.08 0 1.006.387 2.085.87 2.684.1.117.112.22.08.345l-.325 1.33c-.053.22-.175.267-.403.16-1.503-.7-2.442-2.9-2.442-4.665 0-3.8 2.762-7.292 7.962-7.292 4.18 0 7.428 2.977 7.428 6.96 0 4.153-2.617 7.5-6.25 7.5-1.22 0-2.37-.634-2.763-1.38l-.752 2.864c-.272 1.05-.1 2.366-.154 2.435-.054.07-.156.07-.156.07s-.03-.012-.04-.035c-.01 0-.022-.01-.022-.02z" />
                      {/* Standard structural Telegram path mapped directly for clean output scale */}
                      <path d="M21.943 2.5a.735.735 0 0 0-.74-.08L1.754 10.218a.752.752 0 0 0-.056 1.378l5.228 1.63 1.942 6.03a.754.754 0 0 0 1.282.257l2.84-2.443 4.962 3.66a.752.752 0 0 0 1.18-.415l4.316-20.3a.75.75 0 0 0-.61-.815z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-white tracking-wider group-hover:text-sky-400 transition-colors">Telegram Channel</div>
                    <div className="text-xs font-mono text-neutral-500">Updates & Announcements</div>
                  </div>
                </a>

                {/* WhatsApp Channel */}
                <a href="https://whatsapp.com/channel/0029Vb8q2n4KbYMU8jgXBO3H" target="_blank" rel="noopener noreferrer" className="bg-white/[0.01] border border-white/[0.03] p-4 rounded-xl flex items-center gap-4 hover:bg-emerald-950/[0.04] hover:border-emerald-500/30 transition-all duration-300 group">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.454 5.709 1.455h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-white tracking-wider group-hover:text-emerald-400 transition-colors">WhatsApp Channel</div>
                    <div className="text-xs font-mono text-neutral-500">Instant Broadcaster Hub</div>
                  </div>
                </a>

                {/* WhatsApp Group */}
                <a href="https://chat.whatsapp.com/DLhvDiTl9IL0LgJMme62J5" target="_blank" rel="noopener noreferrer" className="bg-white/[0.01] border border-white/[0.03] p-4 rounded-xl flex items-center gap-4 hover:bg-emerald-950/[0.04] hover:border-emerald-500/30 transition-all duration-300 group">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M12.004 2c-5.51 0-9.99 4.49-9.99 10 0 1.77.47 3.44 1.3 4.91L2 22l5.22-1.35c1.42.77 3.03 1.21 4.74 1.21 5.52 0 10-4.49 10-10 0-5.51-4.48-10-9.99-10zm0 18c-1.63 0-3.15-.43-4.48-1.17l-.32-.18-3.13.81.83-3.04-.2-.32C4.02 14.86 3.6 13.5 3.6 12c0-4.63 3.77-8.4 8.4-8.4s8.4 3.77 8.4 8.4-3.77 8.4-8.4 8.4z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-white tracking-wider group-hover:text-emerald-400 transition-colors">WhatsApp Group</div>
                    <div className="text-xs font-mono text-neutral-500">Interactive Community Mesh</div>
                  </div>
                </a>

                {/* Discord Channel */}
                <a href="https://discord.gg/zNkAmVG34" target="_blank" rel="noopener noreferrer" className="bg-white/[0.01] border border-white/[0.03] p-4 rounded-xl flex items-center gap-4 hover:bg-indigo-950/[0.04] hover:border-indigo-500/30 transition-all duration-300 group">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.075.075 0 0 1-.006.127 12.298 12.298 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-white tracking-wider group-hover:text-indigo-400 transition-colors">Discord Channel</div>
                    <div className="text-xs font-mono text-neutral-500">Live Voice & Tech Lounges</div>
                  </div>
                </a>

                {/* Telegram Payment Proof */}
                <a href="https://t.me/jprimepayment" target="_blank" rel="noopener noreferrer" className="bg-white/[0.01] border border-white/[0.03] p-4 rounded-xl flex items-center gap-4 hover:bg-cyan-950/[0.04] hover:border-cyan-500/30 transition-all duration-300 group">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-white tracking-wider group-hover:text-cyan-400 transition-colors">Payment Proof Ledger</div>
                    <div className="text-xs font-mono text-neutral-500">Verified Direct Admin Sales</div>
                  </div>
                </a>

              </div>
            </div>

            {/* ── GLOBAL COMMUNITY DISPATCH ── */}
            <section className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 sm:p-6 hover:bg-cyan-950/[0.01] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-white">
                  Global Community
                </h3>
              </div>
              <p className="text-gray-300 text-sm font-light mb-4">
                We are proud to serve customers from around the world:
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { name: "Canada", flag: "🇨🇦" },
                  { name: "Europe", flag: "🇪🇺" },
                  { name: "Türkiye", flag: "🇹🇷" },
                  { name: "United Arab Emirates", flag: "🇦🇪" },
                  { name: "Sri Lanka", flag: "🇱🇰" },
                  { name: "India", flag: "🇮🇳" }
                ].map((region, idx) => (
                  <div key={idx} className="bg-[#050506] border border-white/[0.02] px-4 py-2.5 rounded-lg flex items-center gap-3 text-xs text-gray-300 font-light">
                    <span className="text-base">{region.flag}</span>
                    <span>{region.name}</span>
                  </div>
                ))}
              </div>
              
              <p className="text-xs font-mono text-neutral-500 mt-4 uppercase tracking-wider text-center sm:text-left">
                And many more regions worldwide. Thank you for choosing JPRIME CHEATS and trusting our services.
              </p>
            </section>

            {/* ── DIRECT TELEMETRY SUPPORT HUBS ── */}
            <section className="bg-[#0E1013] border border-cyan-500/[0.08] p-5 sm:p-6 rounded-xl shadow-[0_0_24px_-12px_rgba(6,182,212,0.1)]">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_6px_#22d3ee]" />
                <h3 className="text-base font-semibold text-white tracking-wide">
                  Contact Support
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-300">
                <div className="bg-[#050506] border border-white/[0.03] p-4 rounded-xl flex flex-col justify-between hover:border-cyan-500/20 transition-all duration-300 group">
                  <span className="text-neutral-500 text-xs font-mono mb-1.5 uppercase">Telegram Support</span>
                  <a
                    href="https://t.me/JPRIMEADMIN"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 font-bold font-mono text-xs hover:underline drop-shadow-[0_0_4px_rgba(34,211,238,0.2)]"
                  >
                    @JPRIMEADMIN
                  </a>
                </div>
                
                <div className="bg-[#050506] border border-white/[0.03] p-4 rounded-xl flex flex-col justify-between hover:border-emerald-500/20 transition-all duration-300 group">
                  <span className="text-neutral-500 text-xs font-mono mb-1.5 uppercase">WhatsApp Support</span>
                  <a
                    href="https://wa.me/917200817883"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 font-bold font-mono text-xs hover:underline drop-shadow-[0_0_4px_rgba(16,185,129,0.2)]"
                  >
                    7200817883 (Connect Node)
                  </a>
                </div>
              </div>
            </section>

            {/* ── SECURITY ADVISORY NOTICE ── */}
            <section className="bg-amber-500/[0.01] border border-amber-500/10 rounded-xl p-5 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                <svg className="w-4 h-4 text-amber-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h4 className="text-xs uppercase tracking-[0.15em] font-semibold text-amber-400">
                  Important Security Notice
                </h4>
              </div>
              <p className="text-xs text-gray-400 font-light leading-relaxed space-y-1">
                <span>For your security, only use the verified operational links listed explicitly on this registry vector. </span>
                <span className="block mt-1 text-neutral-500">JPRIME CHEATS is not responsible for or bound by counterfeit groups, fake tracking channels, or malicious platform impersonation algorithms. Always perform confirmation sweeps before committing payments.</span>
              </p>
            </section>

          </div>

        </div>

      </div>

      {/* ── FULL-WIDTH FOOTER SYSTEM ── */}
      <div className={`w-full max-w-4xl mt-12 relative z-10 transition-opacity duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}>
        <div className="flex items-center justify-between text-[9px] text-neutral-500 uppercase tracking-[0.18em] font-mono px-3 border-t border-white/[0.03] pt-4 pb-2">
          <a href="https://www.jprimecheats.store" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">www.jprimecheats.store</a>
          <div className="flex items-center gap-2">
            <span>Last Sync Matrix: June 2026</span>
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