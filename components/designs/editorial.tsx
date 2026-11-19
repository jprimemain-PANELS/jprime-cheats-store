"use client";

import { ArrowUpRight, User, Wallet } from "lucide-react";
import { AuthButtons } from "@/components/auth-buttons";
import { StoreLogo } from "@/components/store-brand-mark";
import { Footer } from "@/components/footer";
import { FloatingSupport } from "@/components/floating-support";
import { type DesignProps, ProductGrid, STATS, WalletDialog, catName, pad2, useCopy, useWallet } from "./shared";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** OLIVE EDITORIAL: a magazine page. Pill menu, big serif headline beside an arch, numbered "No." cards. */
export function Editorial(p: DesignProps) {
  const c = useCopy();
  const w = useWallet();
  const words = c.title.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop()! : "";
  return (
    <div className="dz-edit min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 px-3 pt-3">
        <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-full border border-[color:var(--store-fg)]/30 bg-[color:var(--store-bg)]/90 px-4 py-2 backdrop-blur">
          <StoreLogo size={30} className="h-7 w-7 shrink-0 rounded-full" />
          <span className="dz-serif hidden sm:block max-w-[11rem] truncate text-lg italic">{c.name}</span>
          <nav className="mx-auto flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Categories">
            {p.categoryIds.map((id) => (
              <button key={id} onClick={() => p.onCategory(id)} className={`dz-serif shrink-0 rounded-full px-3 py-1 text-sm cursor-pointer ${id === p.active ? "bg-[color:var(--store-fg)] text-[color:var(--store-bg)]" : "opacity-75 hover:opacity-100 hover:bg-[color:var(--store-fg)]/10"}`}>{catName(id)}</button>
            ))}
          </nav>
          <button onClick={() => w.setOpen(true)} className="flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--store-fg)]/40 px-3 py-1 text-xs hover:bg-[color:var(--store-fg)]/10 cursor-pointer"><Wallet className="h-3.5 w-3.5" />{w.text}</button>
          <div className="hidden sm:block shrink-0"><AuthButtons /></div>
          <button onClick={p.onProfile} aria-label="Profile" className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[color:var(--store-fg)]/40 hover:bg-[color:var(--store-fg)]/10 cursor-pointer"><User className="h-3.5 w-3.5" /></button>
        </div>
      </header>
      <div className="mt-3 flex justify-center sm:hidden"><AuthButtons /></div>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 sm:px-8 pt-12 pb-12 md:grid-cols-[1.3fr_1fr] md:items-center">
        <div>
          <p className="dz-serif mb-5 text-sm italic opacity-70">Issue No. 01 — {c.tag || "The collection"}</p>
          <h1 className="dz-serif font-normal leading-[0.95] tracking-tight" style={{ fontSize: "clamp(2.8rem, 8vw, 6.5rem)" }}>
            {words.join(" ") || c.title}{last && <> <em className="text-[var(--store-accent)]">{last}</em></>}
          </h1>
          <p className="dz-serif mt-6 max-w-md text-lg opacity-80">{c.sub}</p>
          <button onClick={p.onScroll} className="mt-8 inline-flex items-center gap-2 rounded-full border border-[color:var(--store-fg)] px-6 py-3 text-sm hover:bg-[color:var(--store-fg)] hover:text-[color:var(--store-bg)] transition-colors cursor-pointer">{c.cta}<ArrowUpRight className="h-4 w-4" /></button>
        </div>
        <div className="relative mx-auto w-full max-w-[15rem] md:max-w-sm">
          <div className="dz-arch grid aspect-[3/4] place-items-center overflow-hidden rounded-t-full border border-[color:var(--store-fg)]/30 bg-gradient-to-b from-[color:var(--store-primary)]/35 to-[color:var(--store-surface)]">
            <StoreLogo size={120} className="h-28 w-28 rounded-full opacity-90" />
          </div>
          {c.stats && (
            <dl className="absolute -bottom-4 left-1/2 flex w-full md:w-[110%] -translate-x-1/2 justify-around rounded-full border border-[color:var(--store-fg)]/30 bg-[color:var(--store-bg)] px-4 py-3 text-center text-xs">
              {STATS.map((s) => (<div key={s.label}><dd className="dz-serif text-base italic">{s.value}</dd><dt className="opacity-60">{s.label}</dt></div>))}
            </dl>
          )}
        </div>
      </section>

      <section ref={p.productsRef} className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 sm:px-8 pb-16 pt-8">
        <div className="mb-8 flex items-baseline gap-4 border-b border-[color:var(--store-fg)]/25 pb-3">
          <h2 className="dz-serif text-3xl sm:text-4xl italic">{catName(p.active)}</h2>
          <span className="dz-serif ml-auto text-sm opacity-60">{p.categoryIds.map((id, i) => (<span key={id} className={id === p.active ? "opacity-100 underline underline-offset-4" : ""}>{ROMAN[i] ?? i + 1}{i < p.categoryIds.length - 1 ? " / " : ""}</span>))}</span>
        </div>
        <ProductGrid p={p} cols={Math.min(p.columns, 3)} wrap={(card, _pr, i) => (<div><p className="dz-serif mb-2 text-sm italic opacity-70">No. {pad2(i + 1)}</p>{card}</div>)} />
      </section>
      <div className="mt-auto"><Footer /><FloatingSupport /></div>
      <WalletDialog w={w} />
    </div>
  );
}
