"use client";

import { User, Wallet } from "lucide-react";
import { AuthButtons } from "@/components/auth-buttons";
import { StoreLogo } from "@/components/store-brand-mark";
import { Footer } from "@/components/footer";
import { FloatingSupport } from "@/components/floating-support";
import { type DesignProps, ProductGrid, STATS, WalletDialog, catIcon, catName, useCopy, useWallet } from "./shared";

/** FLOAT GLASS: soft purple glass. A dock on the left (bottom on phones), floating widgets around a big banner. */
export function FloatGlass(p: DesignProps) {
  const c = useCopy();
  const w = useWallet();
  return (
    <div className="dz-glass min-h-screen relative overflow-x-clip">
      
      <nav aria-label="Categories" className="fixed z-40 bottom-3 left-1/2 -translate-x-1/2 md:bottom-auto md:left-4 md:top-1/2 md:-translate-y-1/2 md:translate-x-0">
        <div className="flex items-center gap-1 rounded-[2rem] border border-white/20 bg-white/10 p-2 backdrop-blur-xl shadow-[0_20px_50px_-15px_rgba(0,0,0,.6)] md:flex-col md:gap-2">
          <StoreLogo size={40} className="hidden md:block h-10 w-10 rounded-2xl mb-1" />
          {p.categoryIds.map((id) => {
            const I = catIcon(id); const on = id === p.active;
            return (
              <button key={id} onClick={() => p.onCategory(id)} title={catName(id)} className={`group relative grid h-12 w-12 place-items-center rounded-2xl transition-all cursor-pointer ${on ? "bg-white text-[color:var(--store-bg)] shadow-[0_8px_24px_-6px_rgba(255,255,255,.5)]" : "text-white/70 hover:bg-white/15"}`}>
                <I className="h-5 w-5" />
                <span className="pointer-events-none absolute left-14 hidden whitespace-nowrap rounded-lg bg-black/70 px-2 py-1 text-xs opacity-0 group-hover:opacity-100 md:block">{catName(id)}</span>
              </button>
            );
          })}
          <button onClick={() => w.setOpen(true)} title="Wallet" className="grid h-12 w-12 place-items-center rounded-2xl text-white/70 hover:bg-white/15 cursor-pointer"><Wallet className="h-5 w-5" /></button>
          <button onClick={p.onProfile} title="Profile" className="grid h-12 w-12 place-items-center rounded-2xl text-white/70 hover:bg-white/15 cursor-pointer"><User className="h-5 w-5" /></button>
        </div>
      </nav>

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-8 md:pl-28 pt-5 pb-28 md:pb-10">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs opacity-60">Welcome back</p>
            <p className="truncate text-xl font-bold">{p.username || c.name} 👋</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => w.setOpen(true)} className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-left backdrop-blur-xl cursor-pointer"><span className="block text-[10px] uppercase tracking-widest opacity-60">Wallet</span><b className="text-lg">{w.text}</b></button>
            <AuthButtons />
          </div>
        </header>

        <section className="relative overflow-hidden rounded-[2.5rem] border border-white/20 bg-gradient-to-br from-white/20 to-white/5 p-7 sm:p-12 backdrop-blur-xl">
          <div className="relative z-10 max-w-xl">
            <p className="mb-3 inline-block rounded-full bg-white/15 px-3 py-1 text-xs">{c.tag || "Digital store"}</p>
            <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight">{c.title}</h1>
            <p className="mt-4 text-sm sm:text-base opacity-80">{c.sub}</p>
            <button onClick={p.onScroll} className="mt-6 rounded-2xl bg-white px-7 py-3 text-sm font-bold text-[color:var(--store-bg)] shadow-[0_12px_30px_-10px_rgba(255,255,255,.6)] hover:scale-[1.03] transition-transform cursor-pointer">{c.cta}</button>
          </div>
          {c.stats && (
            <div className="relative z-10 mt-8 flex flex-wrap gap-3 lg:absolute lg:right-10 lg:top-10 lg:mt-0 lg:w-56 lg:flex-col">
              {STATS.map((s, i) => { const I = s.icon; return (
                <div key={s.label} className="dz-float flex items-center gap-3 rounded-2xl border border-white/25 bg-white/15 px-4 py-3 backdrop-blur-xl" style={{ animationDelay: `${i * 0.7}s`, marginLeft: `${(i % 2) * 18}px` }}>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20"><I className="h-4 w-4" /></span>
                  <span className="leading-tight"><b className="block text-sm">{s.value}</b><span className="text-[11px] opacity-70">{s.label}</span></span>
                </div>); })}
            </div>
          )}
        </section>

        <section ref={p.productsRef} className="scroll-mt-6 pt-10">
          <h2 className="mb-5 text-2xl font-extrabold">{catName(p.active)}</h2>
          <ProductGrid p={p} cols={Math.min(p.columns, 3)} />
        </section>
      </div>
      <div className="relative z-10 mt-12 pb-20 md:pb-0 md:pl-24"><Footer /></div>
      <FloatingSupport />
      <WalletDialog w={w} />
    </div>
  );
}
