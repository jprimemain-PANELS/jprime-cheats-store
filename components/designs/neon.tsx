"use client";

import { User, Wallet } from "lucide-react";
import { AuthButtons } from "@/components/auth-buttons";
import { StoreLogo } from "@/components/store-brand-mark";
import { Footer } from "@/components/footer";
import { FloatingSupport } from "@/components/floating-support";
import { type DesignProps, ProductGrid, STATS, WalletDialog, catIcon, catName, useCopy, useWallet } from "./shared";

/** NEON CORE: floating pill menu, a glowing orb in the hero, glass cards with neon edges. */
export function Neon(p: DesignProps) {
  const c = useCopy();
  const w = useWallet();
  return (
    <div className="dz-neon min-h-screen flex flex-col relative overflow-x-clip">
      <div className="dz-neon-grid pointer-events-none absolute inset-0 -z-0" aria-hidden />
      <header className="sticky top-3 z-40 mx-auto mt-3 w-[min(94vw,64rem)]">
        <div className="flex items-center gap-2 rounded-full border border-cyan-300/30 bg-[#070a1a]/80 px-3 py-2 backdrop-blur-xl shadow-[0_0_30px_-8px_var(--store-primary)]">
          <StoreLogo size={34} className="h-8 w-8 shrink-0 rounded-full" />
          <span className="hidden sm:block max-w-[10rem] truncate pr-2 text-sm font-bold tracking-wide">{c.name}</span>
          <nav className="mx-auto flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Categories">
            {p.categoryIds.map((id) => {
              const Icon = catIcon(id); const on = id === p.active;
              return (
                <button key={id} onClick={() => p.onCategory(id)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${on ? "bg-[var(--store-primary)] text-black" : "opacity-70 hover:opacity-100 hover:bg-white/10"}`}>
                  <Icon className="h-4 w-4" /><span className="hidden sm:inline">{catName(id)}</span>
                </button>
              );
            })}
          </nav>
          <button onClick={() => w.setOpen(true)} className="flex shrink-0 items-center gap-1.5 rounded-full border border-fuchsia-400/40 px-3 py-1.5 text-xs font-bold text-fuchsia-200 hover:bg-fuchsia-400/10 cursor-pointer"><Wallet className="h-3.5 w-3.5" />{w.text}</button>
          <div className="hidden sm:block shrink-0"><AuthButtons /></div>
          <button onClick={p.onProfile} aria-label="Profile" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/20 hover:bg-white/10 cursor-pointer"><User className="h-4 w-4" /></button>
        </div>
      </header>

      <section className="relative z-10 px-4 pt-14 pb-10 text-center">
        <div className="dz-orb mx-auto mb-8" aria-hidden><span /><span /><i /></div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.4em] text-cyan-200/70">{c.tag || "Welcome"}</p>
        <h1 className="mx-auto max-w-4xl text-4xl sm:text-6xl lg:text-7xl font-black leading-[1.02] tracking-tight dz-neon-text">{c.title}</h1>
        <p className="mx-auto mt-5 max-w-xl text-sm sm:text-base opacity-70">{c.sub}</p>
        <button onClick={p.onScroll} className="mt-8 rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400 px-8 py-3.5 text-sm font-black text-black shadow-[0_0_40px_-6px_var(--store-accent)] hover:brightness-110 active:scale-95 cursor-pointer">{c.cta}</button>
        {c.stats && (
          <div className="mx-auto mt-10 flex max-w-2xl flex-wrap justify-center gap-3">
            {STATS.map((s) => { const I = s.icon; return (<div key={s.label} className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs backdrop-blur"><I className="h-4 w-4 text-cyan-300" /><b>{s.value}</b><span className="opacity-60">{s.label}</span></div>); })}
          </div>
        )}
      </section>

      <section ref={p.productsRef} className="relative z-10 mx-auto w-full max-w-7xl scroll-mt-20 px-4 sm:px-8 pb-16">
        <h2 className="mb-8 text-center text-2xl sm:text-3xl font-black dz-neon-text">{catName(p.active)}</h2>
        <ProductGrid p={p} />
      </section>
      <div className="relative z-10 mt-auto"><Footer /><FloatingSupport /></div>
      <WalletDialog w={w} />
    </div>
  );
}
