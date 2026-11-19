"use client";

import { ArrowRight, Swords, User, Wallet } from "lucide-react";
import { AuthButtons } from "@/components/auth-buttons";
import { StoreLogo } from "@/components/store-brand-mark";
import { Footer } from "@/components/footer";
import { FloatingSupport } from "@/components/floating-support";
import { type DesignProps, ProductGrid, STATS, WalletDialog, catIcon, catName, pad2, useCopy, useWallet } from "./shared";

/** ARENA: esports HUD. Slanted tabs, a "player strip", a big italic headline beside a scoreboard, cut-corner cards. */
export function Arena(p: DesignProps) {
  const c = useCopy();
  const w = useWallet();
  const bars = [92, 100, 97];
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-8 py-3">
          <div className="dz-slant flex h-10 w-12 shrink-0 items-center justify-center bg-[var(--store-primary)]"><StoreLogo size={28} className="h-7 w-7 rounded-none" /></div>
          <span className="min-w-0 flex-1 truncate text-sm sm:text-lg font-extrabold uppercase italic tracking-wider">{c.name}</span>
          <button onClick={() => w.setOpen(true)} className="dz-slant flex shrink-0 items-center gap-2 border border-[var(--store-accent)] px-3 py-1.5 text-xs font-extrabold text-[var(--store-accent)] cursor-pointer"><span className="flex items-center gap-2"><Wallet className="h-3.5 w-3.5" />{w.text}</span></button>
          <button onClick={p.onProfile} aria-label="Profile" className="grid h-9 w-9 shrink-0 place-items-center border border-white/20 hover:border-[var(--store-primary)] cursor-pointer"><User className="h-4 w-4" /></button>
        </div>
        <div className="border-t border-white/10 bg-black/30">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 sm:px-8 py-2 text-[11px] uppercase tracking-[0.2em]">
            <span className="flex min-w-0 items-center gap-2 opacity-80"><Swords className="h-3.5 w-3.5 shrink-0 text-[var(--store-accent)]" /><span className="truncate">Player: <b className="text-[var(--store-accent)]">{p.username || "guest"}</b></span></span>
            <AuthButtons />
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-8 pt-10 pb-10 lg:grid-cols-[1.5fr_1fr] lg:items-center">
        <div className="min-w-0">
          <p className="mb-3 inline-block bg-[var(--store-primary)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.3em] text-[var(--store-on)] dz-slant"><span>{c.tag || "Season open"}</span></p>
          <h1 className="font-black leading-[0.92]" style={{ fontSize: "clamp(2.4rem, 9vw, 6rem)", overflowWrap: "anywhere" }}>{c.title}</h1>
          <p className="mt-5 max-w-xl text-sm sm:text-base opacity-75">{c.sub}</p>
          <button onClick={p.onScroll} className="dz-slant mt-7 inline-flex bg-[var(--store-primary)] px-8 py-3.5 text-sm font-black uppercase tracking-widest text-[var(--store-on)] hover:brightness-110 cursor-pointer"><span className="flex items-center gap-2">{c.cta}<ArrowRight className="h-4 w-4" /></span></button>
        </div>
        {c.stats && (
          <div className="dz-hud border border-white/15 bg-black/30 p-5">
            <p className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.3em] text-[var(--store-accent)]">Scoreboard</p>
            <div className="space-y-4">
              {STATS.map((s, i) => { const I = s.icon; return (
                <div key={s.label}>
                  <div className="mb-1.5 flex items-center justify-between text-xs uppercase tracking-wider"><span className="flex items-center gap-2 opacity-70"><I className="h-3.5 w-3.5" />{s.label}</span><b>{s.value}</b></div>
                  <div className="dz-bar"><i style={{ width: `${bars[i]}%` }} /></div>
                </div>); })}
            </div>
          </div>
        )}
      </section>

      <section ref={p.productsRef} className="mx-auto w-full max-w-7xl scroll-mt-4 px-4 sm:px-8 pb-16">
        <nav aria-label="Categories" className="mb-8 flex gap-2 overflow-x-auto pb-2">
          {p.categoryIds.map((id, i) => {
            const I = catIcon(id); const on = id === p.active;
            return (
              <button key={id} onClick={() => p.onCategory(id)} className={`dz-slant shrink-0 border px-5 py-2.5 text-xs sm:text-sm font-extrabold uppercase tracking-wider cursor-pointer transition-colors ${on ? "border-[var(--store-primary)] bg-[var(--store-primary)] text-[var(--store-on)]" : "border-white/20 hover:border-[var(--store-primary)]"}`}>
                <span className="flex items-center gap-2"><span className="opacity-60">{pad2(i + 1)}</span><I className="h-4 w-4" />{catName(id)}</span>
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
