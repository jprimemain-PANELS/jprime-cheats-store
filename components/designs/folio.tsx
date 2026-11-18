"use client";

import { ArrowDown, User, Wallet } from "lucide-react";
import { AuthButtons } from "@/components/auth-buttons";
import { StoreLogo } from "@/components/store-brand-mark";
import { Footer } from "@/components/footer";
import { FloatingSupport } from "@/components/floating-support";
import { type DesignProps, ProductGrid, STATS, WalletDialog, catName, pad2, useCopy, useWallet } from "./shared";

/** FOLIO: dark portfolio. Slim top bar, a giant headline, a numbered index of categories, sharp cards. */
export function Folio(p: DesignProps) {
  const c = useCopy();
  const w = useWallet();
  const words = c.title.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop()! : "";
  const first = words.join(" ");
  return (
    <div className="dz-folio min-h-screen flex flex-col">
      <header className="flex items-center justify-between gap-3 px-5 sm:px-10 py-5 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <StoreLogo size={36} className="h-9 w-9 shrink-0 rounded-md" />
          <span className="truncate text-xs sm:text-sm font-black uppercase tracking-[0.25em]">{c.name}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button onClick={() => w.setOpen(true)} className="flex items-center gap-2 border border-white/20 px-3 py-1.5 text-xs font-bold hover:border-[var(--store-accent)] hover:text-[var(--store-accent)] cursor-pointer"><Wallet className="h-3.5 w-3.5" />{w.text}</button>
          <AuthButtons />
          <button onClick={p.onProfile} aria-label="Profile" className="grid h-8 w-8 place-items-center border border-white/20 hover:border-[var(--store-accent)] cursor-pointer"><User className="h-4 w-4" /></button>
        </div>
      </header>

      <section className="px-5 sm:px-10 pt-10 sm:pt-16 pb-10">
        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.35em] text-[var(--store-accent)]">— {c.tag || "Digital store"}</p>
        <h1 className="font-black uppercase leading-[0.88] tracking-tighter" style={{ fontSize: "clamp(3rem, 14vw, 11.5rem)" }}>
          <span className="block">{first || c.title}</span>
          {last && <span className="block text-[var(--store-accent)]">{last}.</span>}
        </h1>
        <div className="mt-10 grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-end">
          <p className="max-w-xl text-base sm:text-lg opacity-70">{c.sub}</p>
          {c.stats && (
            <dl className="grid grid-cols-3 gap-3 border-t border-white/15 pt-4">
              {STATS.map((s) => (<div key={s.label}><dt className="text-[10px] uppercase tracking-widest opacity-50">{s.label}</dt><dd className="text-lg font-black">{s.value}</dd></div>))}
            </dl>
          )}
        </div>
        <button onClick={p.onScroll} className="mt-10 inline-flex items-center gap-3 bg-[var(--store-accent)] px-7 py-3.5 text-sm font-black uppercase tracking-widest text-black hover:brightness-110 cursor-pointer">{c.cta}<ArrowDown className="h-4 w-4" /></button>
      </section>

      <section ref={p.productsRef} className="scroll-mt-4 px-5 sm:px-10 pb-16">
        <ol className="mb-10 border-t border-white/15">
          {p.categoryIds.map((id, i) => {
            const on = id === p.active;
            return (
              <li key={id} className="border-b border-white/15">
                <button onClick={() => p.onCategory(id)} aria-current={on} className={`group flex w-full items-baseline gap-4 sm:gap-8 py-4 sm:py-5 text-left cursor-pointer transition-colors ${on ? "text-[var(--store-accent)]" : "opacity-60 hover:opacity-100 hover:text-[var(--store-accent)]"}`}>
                  <span className="w-8 text-xs font-bold tabular-nums opacity-70">{pad2(i + 1)}</span>
                  <span className="flex-1 text-2xl sm:text-5xl font-black uppercase tracking-tight">{catName(id)}</span>
                  <span className="text-xl sm:text-3xl transition-transform group-hover:translate-x-1">{on ? "●" : "→"}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <ProductGrid p={p} cols={Math.min(p.columns, 3)} />
      </section>

      <div className="mt-auto"><Footer /><FloatingSupport /></div>
      <WalletDialog w={w} />
    </div>
  );
}
