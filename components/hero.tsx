"use client";

import { ChevronDown, ChevronUp, Volume2 } from "lucide-react";
import { useState } from "react";

interface HeroProps {
  onScrollToProducts: () => void;
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

export function Hero({ onScrollToProducts }: HeroProps) {
  const [showAudio, setShowAudio] = useState(false);

  return (
    <section className="relative flex flex-col items-center justify-start px-4 pt-20 pb-2 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/3 rounded-full blur-[80px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/50 border border-border/50 mb-8">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm text-muted-foreground">@JPRIMEADMIN-GARENA</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground mb-6">
          <span className="block">JPRIME</span>
          <span className="block text-primary">CHEATS STORE</span>
        </h1>

        {/* Tagline */}
        <p className="text-sm text-muted-foreground mb-8 max-w-xl mx-auto text-balance">
          Free Fire — professional mobile panel for CS &amp; BR rank push and all mods. Trusted by 10,000+ users.
        </p>

        {/* Service explainer */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-secondary/30 border border-border/50 rounded-2xl overflow-hidden text-left">
            <button
              type="button"
              onClick={() => setShowAudio(!showAudio)}
              aria-expanded={showAudio}
              className="w-full flex items-center justify-between gap-4 p-5 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Volume2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    How our service works
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    New here? Listen before you buy.
                  </p>
                </div>
              </div>
              {showAudio ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>

            {showAudio && (
              <div className="grid sm:grid-cols-3 gap-3 px-5 pb-5">
                {explainers.map((item) => (
                  <div key={item.label} className="bg-background/40 border border-border/50 rounded-xl p-3.5">
                    <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                      <span>{item.flag}</span>
                      <span>{item.label}</span>
                    </p>
                    <audio controls className="w-full h-9">
                      <source src={item.src} />
                    </audio>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}