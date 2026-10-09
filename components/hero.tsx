"use client";

import {
  ArrowDown,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  Users,
  Volume2,
  Zap,
} from "lucide-react";
import { useState } from "react";

interface HeroProps {
  onScrollToProducts?: () => void;
}

const explainers = [
  {
    flag: "🇮🇳",
    label: "Tamil",
    src: "https://res.cloudinary.com/dda4gh2wm/video/upload/v1780368063/tamil_eiy1qn.ogg",
  },
  {
    flag: "🇬🇧",
    label: "English",
    src: "https://res.cloudinary.com/dda4gh2wm/video/upload/v1780367929/ENGLISH_EXPLAIN_ibnbhi.mp3",
  },
  {
    flag: "🇮🇳",
    label: "Hindi",
    src: "https://res.cloudinary.com/dda4gh2wm/video/upload/v1780368110/HINDI_EXPLAIN_hhgjwf.mp3",
  },
];

const stats = [
  { icon: Users, value: "10,000+", label: "Users" },
  { icon: ShieldCheck, value: "Trusted", label: "Verified" },
  { icon: Zap, value: "Instant", label: "Auto Delivery" },
];

export function Hero({ onScrollToProducts }: HeroProps) {
  const [showAudio, setShowAudio] = useState(false);
  const [active, setActive] = useState(0);
  const current = explainers[active];

  return (
    <section className="relative w-full overflow-hidden bg-[#07040f] px-4 pb-8 pt-24 text-white selection:bg-fuchsia-500 selection:text-white">
      {/* Glow blobs */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-violet-600/30 blur-[120px]" />
      <div className="pointer-events-none absolute top-40 -right-24 h-[260px] w-[260px] rounded-full bg-fuchsia-500/20 blur-[100px]" />
      <div className="pointer-events-none absolute top-72 -left-24 h-[260px] w-[260px] rounded-full bg-orange-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/60 to-transparent" />

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center">
        {/* Admin pill */}
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
          <span className="text-xs font-medium text-white/60">
            Managed by{" "}
            <span className="font-semibold text-white">@JPRIMEADMIN-GARENA</span>
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          <span className="block text-white">JPRIME</span>
          <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-orange-300 bg-clip-text text-transparent">
            Cheats Store
          </span>
        </h1>

        {/* Description */}
        <p className="mt-5 max-w-md text-sm leading-relaxed text-white/60 sm:text-base">
          Free Fire — professional mobile panel for CS &amp; BR rank push and
          all mods. Trusted by{" "}
          <span className="font-semibold text-white">10,000+ users</span>.
        </p>

        {/* CTA */}
        <button
          type="button"
          onClick={onScrollToProducts}
          className="group mt-7 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-7 py-3.5 text-sm font-semibold shadow-[0_8px_40px_-8px_rgba(192,38,211,0.8)] transition-all hover:scale-[1.03] hover:shadow-[0_8px_50px_-6px_rgba(192,38,211,1)] active:scale-95"
        >
          Browse Panels
          <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
        </button>

        {/* Stat tiles (compact) */}
        <div className="mt-8 grid w-full max-w-md grid-cols-3 gap-2">
          {stats.map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-3 backdrop-blur-md"
            >
              <Icon className="mx-auto mb-1.5 h-3.5 w-3.5 text-fuchsia-400" />
              <div className="text-[13px] font-bold text-white">{value}</div>
              <div className="mt-0.5 text-[9px] uppercase tracking-wide text-white/40">
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Audio guide (compact) */}
        <div className="mt-4 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left backdrop-blur-md">
          <button
            type="button"
            onClick={() => setShowAudio((v) => !v)}
            aria-expanded={showAudio}
            className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 text-fuchsia-300">
                <Volume2 className="h-4 w-4" />
              </div>
              <div className="leading-tight">
                <span className="block text-[13px] font-semibold text-white">
                  How our service works
                </span>
                <span className="text-[11px] text-white/50">
                  New here? Listen before you buy.
                </span>
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-white/50 transition-transform duration-300 ${
                showAudio ? "rotate-180" : ""
              }`}
            />
          </button>

          {showAudio && (
            <div className="space-y-2.5 border-t border-white/10 bg-black/30 p-3">
              <div className="flex gap-1.5">
                {explainers.map((item, i) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-1.5 text-[11px] font-semibold transition-all ${
                      active === i
                        ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-fuchsia-900/40"
                        : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    <span>{item.flag}</span>
                    {item.label}
                  </button>
                ))}
              </div>

              <audio
                key={current.label}
                controls
                className="h-8 w-full opacity-90"
              >
                <source src={current.src} />
              </audio>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}