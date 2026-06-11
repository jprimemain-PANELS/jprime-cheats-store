"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface HeroProps {
  onScrollToProducts: () => void;
}

export function Hero({ onScrollToProducts }: HeroProps) {
  const [showAudio, setShowAudio] = useState(false);
  return (
    <section className="relative flex flex-col items-center justify-start px-4 pt-20 pb-2 overflow-hidden">
      {/* Background Effects */}
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
        <p className="text-xl sm:text-2xl text-muted-foreground mb-6 max-w-2xl mx-auto text-balance">
          Free Fire Panel
        </p>

        {/* Voice Notes */}
<div className="max-w-5xl mx-auto mb-8">

 <div
  className="bg-zinc-900/40 border border-cyan-500/20 rounded-3xl p-6 backdrop-blur-xl cursor-pointer"
  onClick={() => setShowAudio(!showAudio)}
>

    <h2 className="text-xl sm:text-2xl font-bold text-cyan-400 mb-2">

      📢 OUR SERVICE EXPLANATION

    </h2>

    <p className="text-zinc-400 mb-3">

      New users, please listen before purchasing

    </p>
    <div className="flex justify-center mb-4">
  {showAudio ? (
    <ChevronUp className="h-6 w-6 text-cyan-400 animate-bounce" />
  ) : (
    <ChevronDown className="h-6 w-6 text-cyan-400 animate-bounce" />
  )}
</div>

    {showAudio && (
<div className="grid md:grid-cols-3 gap-4">

      <div className="bg-black/40 rounded-2xl p-4">

        <h3 className="font-bold mb-3">
          🇮🇳 Tamil
        </h3>

        <audio controls className="w-full">

          <source src="https://res.cloudinary.com/dda4gh2wm/video/upload/v1780368063/tamil_eiy1qn.ogg" />

        </audio>

      </div>

      <div className="bg-black/40 rounded-2xl p-4">

        <h3 className="font-bold mb-3">
          🇬🇧 English
        </h3>

        <audio controls className="w-full">

          <source src="https://res.cloudinary.com/dda4gh2wm/video/upload/v1780367929/ENGLISH_EXPLAIN_ibnbhi.mp3" />

        </audio>

      </div>

      <div className="bg-black/40 rounded-2xl p-4">

        <h3 className="font-bold mb-3">
          🇮🇳 Hindi
        </h3>

        <audio controls className="w-full">

          <source src="https://res.cloudinary.com/dda4gh2wm/video/upload/v1780368110/HINDI_EXPLAIN_hhgjwf.mp3" />

        </audio>

      </div>

    </div>
    )}

  </div>

</div>

      </div>
    </section>
  );
}
