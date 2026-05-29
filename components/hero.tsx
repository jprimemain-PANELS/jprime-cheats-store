"use client";

import { ChevronDown } from "lucide-react";

interface HeroProps {
  onScrollToProducts: () => void;
}

export function Hero({ onScrollToProducts }: HeroProps) {
  return (
    <section className="relative min-h-[70vh] flex flex-col items-center justify-center px-4 py-20 overflow-hidden">
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
          <span className="text-sm text-muted-foreground">Premium Gaming Solutions</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground mb-6">
          <span className="block">JPRIME</span>
          <span className="block text-primary">CHEATS STORE</span>
        </h1>

        {/* Tagline */}
        <p className="text-xl sm:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto text-balance">
          Premium FF Panel Purchase
        </p>

        {/* Categories Preview */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary/30 border border-border/30">
            <span className="text-sm font-medium text-foreground">Mobile Panel</span>
          </div>
          <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary/30 border border-border/30">
            <span className="text-sm font-medium text-foreground">PC Panel</span>
          </div>
          <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary/30 border border-border/30">
            <span className="text-sm font-medium text-foreground">iOS Panel</span>
          </div>
        </div>

        {/* Scroll Indicator */}
        <button
          onClick={onScrollToProducts}
          className="inline-flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-300 group"
        >
          <span className="text-sm">Explore Products</span>
          <ChevronDown className="h-5 w-5 animate-bounce" />
        </button>
      </div>
    </section>
  );
}
