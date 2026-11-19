"use client";

import { Rocket, User, Wallet } from "lucide-react";
import { AuthButtons } from "@/components/auth-buttons";
import { StoreLogo } from "@/components/store-brand-mark";
import { Footer } from "@/components/footer";
import { FloatingSupport } from "@/components/floating-support";
import { type DesignProps, ProductGrid, STATS, WalletDialog, catIcon, catName, useCopy, useWallet } from "./shared";

/** RETROWAVE: synthwave sunset behind the page (sun + grid floor are page backdrop), chrome italic title, glowing pills. */
export function Retrowave(p: DesignProps) {
  const c = useCopy();
  const w = useWallet();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 sm:px-8 py-4">
        <StoreLogo size={36} className="h-9 w-9 shrink-0 rounded-full ring-2 ring-[var(--store-primary)]" />
        <span className="min-w-0 flex-1 truncate text-sm sm:text-base font-black italic uppercase tracking-wider">{c.name}</span>
        <button onClick={() => w.setOpen(true)} className="flex shrink-0 items-center gap-1.5 rounded-full border-2 border-[var(--store-accent)] px-3 py-1.5 text-xs font-black text-[var(--store-accent)] shadow-[0_0_18px_-4px_var(--store-accent)] cursor-pointer"><Wallet className="h-3.5 w-3.5" />{w.text}</button>
        <button onClick={p.onProfile} aria-label="Profile" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-[var(--store-primary)] shadow-[0_0_18px_-4px_var(--store-primary)] cursor-pointer"><User className="h-4 w-4" /></button>
      </header>
      <div className="mx-auto flex w-full max-w-6xl justify-end px-4 sm:px-8"><AuthButtons /></div>

      <section className="mx-auto w-full max-w-5xl px-4 sm:px-8 pt-10 pb-14 text-center">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--store-accent)] px-4 py-1 text-[11px] font-black uppercase tracking-[0.3em] text-[var(--store-accent)]"><Rocket className="h-3.5 w-3.5" />{c.tag || "Now online"}</p>
        <h1 className="dz-chrome mx-auto max-w-4xl font-black uppercase leading-[1.02]" style={{ fontSize: "clamp(2.3rem, 10vw, 6.2rem)", overflowWrap: "anywhere" }}>{c.title}</h1>
        <p className="mx-auto mt-5 max-w-xl text-sm sm:text-base opacity-85">{c.sub}</p>
        <button onClick={p.onScroll} className="mt-8 rounded-full bg-gradient-to-r from-[var(--store-primary)] to-[var(--store-accent)] px-9 py-3.5 text-sm font-black uppercase italic tracking-widest text-[var(--store-on)] shadow-[0_0_36px_-6px_var(--store-primary)] hover:scale-105 transition-transform cursor-pointer">{c.cta}</button>
        {c.stats && (
          <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
            {STATS.map((s) => { const I = s.icon; return (
              <div key={s.label} className="rounded-2xl border border-[var(--store-primary)]/50 bg-black/30 px-2 py-3 backdrop-blur">
                <I className="mx-auto mb-1 h-4 w-4 text-[var(--store-accent)]" /><b className="block truncate text-sm sm:text-base">{s.value}</b><span className="block truncate text-[10px] sm:text-xs opacity-70">{s.label}</span>
              </div>); })}
          </div>
        )}
      </section>

      <section ref={p.productsRef} className="mx-auto w-full max-w-7xl scroll-mt-4 px-4 sm:px-8 pb-16">
        <nav aria-label="Categories" className="mb-8 flex justify-start gap-2 overflow-x-auto pb-2 sm:justify-center">
          {p.categoryIds.map((id) => {
            const I = catIcon(id); const on = id === p.active;
            return (
              <button key={id} onClick={() => p.onCategory(id)} className={`flex shrink-0 items-center gap-2 rounded-full border-2 px-5 py-2 text-xs sm:text-sm font-black uppercase italic cursor-pointer transition-all ${on ? "border-transparent bg-gradient-to-r from-[var(--store-primary)] to-[var(--store-accent)] text-[var(--store-on)] shadow-[0_0_24px_-4px_var(--store-primary)]" : "border-[var(--store-primary)]/60 hover:shadow-[0_0_18px_-4px_var(--store-primary)]"}`}>
                <I className="h-4 w-4" />{catName(id)}
              </button>
            );
          })}
        </nav>
        <ProductGrid p={p} cols={Math.min(p.columns, 3)} />
      </section>
      <div className="mt-auto"><Footer /><FloatingSupport /></div>
      <WalletDialog w={w} />
    </div>
  );
}
