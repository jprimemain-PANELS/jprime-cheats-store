"use client";

import type { ReactNode } from "react";
import { Footer } from "@/components/footer";
import { FloatingSupport } from "@/components/floating-support";
import { StoreLogo } from "@/components/store-brand-mark";
import { WalletDialog, type WalletApi } from "./shared";

/** Shared page frame for the designs: content + footer + floating support + wallet dialog. */
export function Frame({ w, children, after }: { w: WalletApi; children: ReactNode; after?: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {children}
      <div className="mt-auto">{after}<Footer /><FloatingSupport /></div>
      <WalletDialog w={w} />
    </div>
  );
}

export function Brand({ name, size = 32, rounded = "rounded-lg", textClass = "" }: { name: string; size?: number; rounded?: string; textClass?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <StoreLogo size={size} className={`shrink-0 ${rounded}`} />
      <span className={`truncate font-bold ${textClass}`}>{name}</span>
    </span>
  );
}

/** First word of the title and the rest (for two-tone headlines). */
export function splitTitle(t: string): [string, string] {
  const s = String(t || "").trim();
  const i = s.indexOf(" ");
  return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + 1)];
}
