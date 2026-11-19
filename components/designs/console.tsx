"use client";

import { LayoutGrid, Plus, User } from "lucide-react";
import { AuthButtons } from "@/components/auth-buttons";
import { StoreLogo } from "@/components/store-brand-mark";
import { Footer } from "@/components/footer";
import { FloatingSupport } from "@/components/floating-support";
import { type DesignProps, ProductGrid, STATS, WalletDialog, catIcon, catName, useCopy, useWallet } from "./shared";

/** CONSOLE: a clean dashboard. Sidebar of categories (chips on phones), wallet tile, KPI tiles, panel-style cards. */
export function Console(p: DesignProps) {
  const c = useCopy();
  const w = useWallet();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-[var(--store-line)] bg-[color:var(--store-bg)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6 py-3">
          <StoreLogo size={32} className="h-8 w-8 shrink-0 rounded-lg" />
          <span className="min-w-0 flex-1 truncate text-sm sm:text-base font-semibold">{c.name}</span>
          <span className="hidden sm:flex items-center gap-2 text-xs opacity-70"><i className="dz-dot" />All systems online</span>
          <div className="hidden sm:block"><AuthButtons /></div>
          <button onClick={p.onProfile} aria-label="Profile" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--store-line)] hover:border-[var(--store-primary)] cursor-pointer"><User className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 sm:px-6 py-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <p className="mb-2 hidden lg:block text-[11px] font-semibold uppercase tracking-widest opacity-50">Categories</p>
          <nav aria-label="Categories" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible">
            {p.categoryIds.map((id) => {
              const I = catIcon(id); const on = id === p.active;
              return (
                <button key={id} onClick={() => p.onCategory(id)} className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium text-left cursor-pointer transition-colors ${on ? "bg-[var(--store-primary)] text-[var(--store-on)]" : "border border-[var(--store-line)] lg:border-transparent opacity-80 hover:bg-white/5 hover:opacity-100"}`}>
                  <I className="h-4 w-4" />{catName(id)}
                </button>
              );
            })}
          </nav>
          <div className="dz-panel mt-5 hidden lg:block p-4">
            <p className="text-[11px] uppercase tracking-widest opacity-50">Wallet balance</p>
            <p className="mt-1 text-2xl font-bold">{w.text}</p>
            <button onClick={() => w.setOpen(true)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--store-primary)] py-2 text-sm font-semibold text-[var(--store-on)] hover:brightness-110 cursor-pointer"><Plus className="h-4 w-4" />Add funds</button>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="dz-panel flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
            <div className="min-w-0">
              <p className="text-xs opacity-60">Welcome back{p.username ? `, ${p.username}` : ""}</p>
              <h1 className="mt-1 text-xl sm:text-3xl font-bold leading-tight break-words">{c.title}</h1>
              <p className="mt-2 max-w-xl text-sm opacity-70">{c.sub}</p>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <button onClick={p.onScroll} className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[var(--store-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--store-on)] hover:brightness-110 cursor-pointer sm:flex-none"><LayoutGrid className="h-4 w-4" />{c.cta}</button>
              <button onClick={() => w.setOpen(true)} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--store-line)] px-5 py-2.5 text-sm font-semibold hover:border-[var(--store-primary)] cursor-pointer lg:hidden sm:flex-none">{w.text}<Plus className="h-4 w-4" /></button>
            </div>
          </div>

          {c.stats && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {STATS.map((s) => { const I = s.icon; return (
                <div key={s.label} className="dz-panel min-w-0 p-3 sm:p-4">
                  <I className="mb-2 h-4 w-4 text-[var(--store-accent)]" />
                  <p className="truncate text-base sm:text-xl font-bold">{s.value}</p>
                  <p className="truncate text-[11px] sm:text-xs opacity-60">{s.label}</p>
                </div>); })}
            </div>
          )}

          <section ref={p.productsRef} className="scroll-mt-20 pt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{catName(p.active)}</h2>
              <span className="text-xs opacity-60">{p.products.length} item{p.products.length === 1 ? "" : "s"}</span>
            </div>
            <ProductGrid p={p} cols={Math.min(p.columns, 3)} gap="gap-4 sm:gap-5" />
          </section>
        </main>
      </div>
      <div className="mt-auto"><div className="mx-auto flex justify-center pb-2 sm:hidden"><AuthButtons /></div><Footer /><FloatingSupport /></div>
      <WalletDialog w={w} />
    </div>
  );
}
