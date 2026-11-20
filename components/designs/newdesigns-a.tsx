"use client";

import { useState } from "react";
import { ArrowRight, ArrowUpRight, Menu, Plus, User, Wallet, X } from "lucide-react";
import { AuthButtons } from "@/components/auth-buttons";
import { Brand, Frame } from "./parts";
import { type DesignProps, ProductGrid, STATS, catIcon, catName, pad2, useCopy, useWallet } from "./shared";

const chip = (on: boolean) => `shrink-0 rounded-full border px-4 py-2 text-xs sm:text-sm font-semibold cursor-pointer transition-colors ${on ? "border-transparent bg-[var(--store-primary)] text-[var(--store-on)]" : "border-[var(--store-line)] hover:border-[var(--store-primary)]"}`;
const Chips = ({ p, className = "" }: { p: DesignProps; className?: string }) => (
  <nav aria-label="Categories" className={`flex gap-2 overflow-x-auto pb-1 ${className}`}>
    {p.categoryIds.map((id) => { const I = catIcon(id); return <button key={id} onClick={() => p.onCategory(id)} className={`${chip(id === p.active)} inline-flex items-center gap-2`}><I className="h-4 w-4" />{catName(id)}</button>; })}
  </nav>
);

/** TRAVEL: warm ivory + deep teal, giant condensed headline, SIDE SLIDE-IN MENU (hamburger opens a left drawer). */
export function Travel(p: DesignProps) {
  const c = useCopy(); const w = useWallet(); const [open, setOpen] = useState(false);
  return (
    <Frame w={w}>
      <div className={`fixed inset-0 z-[90] bg-black/50 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={() => setOpen(false)} aria-hidden />
      <aside aria-hidden={!open} className={`fixed inset-y-0 left-0 z-[100] flex w-[84%] max-w-sm flex-col gap-6 overflow-y-auto bg-[var(--store-primary)] p-6 text-[var(--store-on)] shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between"><Brand name={c.name} textClass="dz-display text-xl uppercase" /><button onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-9 w-9 place-items-center rounded-full border border-current/40 cursor-pointer"><X className="h-4 w-4" /></button></div>
        <nav className="flex flex-col">
          {p.categoryIds.map((id, i) => { const I = catIcon(id); return (
            <button key={id} tabIndex={open ? 0 : -1} onClick={() => { p.onCategory(id); setOpen(false); p.onScroll(); }} className={`dz-display flex items-center gap-3 border-b border-current/20 py-4 text-left text-3xl uppercase cursor-pointer ${id === p.active ? "text-[var(--store-accent)]" : ""}`}><span className="text-sm opacity-60">{pad2(i + 1)}</span><I className="h-5 w-5" />{catName(id)}</button>); })}
        </nav>
        <div className="rounded-2xl bg-black/15 p-4"><p className="text-xs opacity-70">Wallet balance</p><p className="text-2xl font-bold">{w.text}</p><button tabIndex={open ? 0 : -1} onClick={() => { setOpen(false); w.setOpen(true); }} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--store-accent)] px-4 py-2 text-sm font-bold text-white cursor-pointer"><Plus className="h-4 w-4" />Add funds</button></div>
        <div className="mt-auto"><AuthButtons /></div>
      </aside>

      <header className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 sm:px-8 py-4">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--store-line)] cursor-pointer"><Menu className="h-5 w-5" /></button>
        <span className="min-w-0 flex-1"><Brand name={c.name} textClass="dz-display text-lg uppercase tracking-wide" /></span>
        <button onClick={() => w.setOpen(true)} className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--store-line)] px-3.5 py-2 text-xs font-bold cursor-pointer"><Wallet className="h-4 w-4" />{w.text}</button>
        <button onClick={p.onProfile} aria-label="Profile" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--store-accent)] text-white cursor-pointer"><User className="h-4 w-4" /></button>
      </header>

      <section className="mx-auto w-full max-w-7xl px-4 sm:px-8 pt-6 pb-10">
        <p className="mb-3 text-center text-[10px] sm:text-xs font-bold uppercase tracking-[0.4em] opacity-70">{p.categoryIds.map(catName).join(" · ")}</p>
        <h1 className="dz-display text-center uppercase leading-[0.9] text-[var(--store-primary)]" style={{ fontSize: "clamp(3rem, 15.5vw, 11rem)", overflowWrap: "anywhere" }}>{c.title}</h1>
        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div><p className="max-w-md text-sm font-semibold uppercase tracking-[0.18em] text-[var(--store-primary)]">{c.sub}</p>
            <button onClick={p.onScroll} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--store-accent)] px-7 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg cursor-pointer">{c.cta}<ArrowRight className="h-4 w-4" /></button></div>
          {c.stats && <ul className="flex gap-6 border-t border-[var(--store-line)] pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">{STATS.map((s) => { const I = s.icon; return <li key={s.label} className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider"><I className="h-5 w-5 text-[var(--store-accent)]" />{s.label}</li>; })}</ul>}
        </div>
      </section>
      <section ref={p.productsRef} className="mx-auto w-full max-w-7xl scroll-mt-4 px-4 sm:px-8 pb-16">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 className="dz-display text-3xl uppercase text-[var(--store-primary)]">{catName(p.active)}</h2><Chips p={p} /></div>
        <ProductGrid p={p} cols={Math.min(p.columns, 3)} />
      </section>
    </Frame>
  );
}

/** LIME STUDIO: ivory, black type, neon-lime sphere with rings, outline pills, text nav. */
export function Lime(p: DesignProps) {
  const c = useCopy(); const w = useWallet();
  return (
    <Frame w={w}>
      <header className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 sm:px-8 py-4">
        <Brand name={c.name} rounded="rounded-full" textClass="text-base tracking-tight" />
        <nav className="mx-auto hidden md:flex items-center gap-8 text-[11px] font-bold uppercase tracking-[0.2em]">{p.categoryIds.map((id) => <button key={id} onClick={() => { p.onCategory(id); p.onScroll(); }} className={`cursor-pointer ${id === p.active ? "underline underline-offset-8 decoration-[var(--dz-lime)] decoration-4" : "opacity-70 hover:opacity-100"}`}>{catName(id)}</button>)}</nav>
        <span className="flex-1 md:hidden" />
        <button onClick={() => w.setOpen(true)} className="flex items-center gap-2 rounded-full border border-[var(--store-fg)] px-4 py-2 text-xs font-bold cursor-pointer">{w.text}<i className="h-3 w-3 rounded-full bg-[var(--dz-lime)]" /></button>
        <button onClick={p.onProfile} aria-label="Profile" className="grid h-9 w-9 place-items-center rounded-full border border-[var(--store-fg)] cursor-pointer"><User className="h-4 w-4" /></button>
      </header>
      <div className="mx-auto flex w-full max-w-7xl justify-end px-4 sm:px-8"><AuthButtons /></div>
      <section className="mx-auto grid w-full max-w-7xl items-center gap-6 px-4 sm:px-8 pt-8 pb-12 md:grid-cols-[1.1fr_1fr]">
        <div className="min-w-0">
          <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.3em] opacity-70">{c.tag || "Smart tools for modern teams"}<span className="ml-2 inline-block h-[3px] w-10 align-middle bg-[var(--dz-lime)]" /></p>
          <h1 className="font-black leading-[0.9] tracking-[-0.05em]" style={{ fontSize: "clamp(2.6rem, 10vw, 6.5rem)", overflowWrap: "anywhere" }}>{c.title}<span className="text-[var(--dz-lime)]">.</span></h1>
          <p className="mt-6 max-w-sm text-sm opacity-70">{c.sub}</p>
          <button onClick={p.onScroll} className="mt-7 inline-flex items-center gap-2 rounded-full border border-[var(--store-fg)] px-6 py-3 text-xs font-bold uppercase tracking-wider hover:bg-[var(--store-fg)] hover:text-[var(--store-bg)] transition-colors cursor-pointer">{c.cta}<ArrowRight className="h-4 w-4" /></button>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-sm md:max-w-md"><div className="dz-lime-orb" /><div className="dz-lime-ring" /><div className="dz-lime-ring dz-lime-ring2" />
          <ul className="absolute right-0 top-0 hidden sm:block text-right text-[10px] font-bold uppercase tracking-[0.25em] opacity-70">{STATS.map((s) => <li key={s.label}>{s.label}</li>)}</ul></div>
      </section>
      <section ref={p.productsRef} className="mx-auto w-full max-w-7xl scroll-mt-4 px-4 sm:px-8 pb-16">
        <Chips p={p} className="mb-8 md:hidden" />
        <ProductGrid p={p} cols={Math.min(p.columns, 3)} />
      </section>
    </Frame>
  );
}

/** MIDNIGHT STUDIO: pure black, centred headline, centred nav, two buttons, glowing bust-arch art below. */
export function Midnight(p: DesignProps) {
  const c = useCopy(); const w = useWallet();
  return (
    <Frame w={w}>
      <header className="mx-auto grid w-full max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 sm:px-8 py-4">
        <Brand name={c.name} textClass="text-sm" />
        <nav className="hidden md:flex justify-center gap-8 text-sm opacity-90">{p.categoryIds.map((id) => <button key={id} onClick={() => { p.onCategory(id); p.onScroll(); }} className={`cursor-pointer ${id === p.active ? "font-bold" : "opacity-60 hover:opacity-100"}`}>{catName(id)}</button>)}</nav>
        <span className="md:hidden" />
        <div className="flex items-center gap-2"><AuthButtons /><button onClick={() => w.setOpen(true)} className="flex items-center gap-1.5 rounded-full border border-[var(--store-line)] px-4 py-2 text-xs font-semibold cursor-pointer">{w.text}<ArrowUpRight className="h-3.5 w-3.5" /></button><button onClick={p.onProfile} aria-label="Profile" className="grid h-9 w-9 place-items-center rounded-full border border-[var(--store-line)] cursor-pointer"><User className="h-4 w-4" /></button></div>
      </header>
      <section className="relative mx-auto w-full max-w-5xl overflow-hidden px-4 sm:px-8 pt-12 text-center">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.35em] opacity-70">{c.tag || "Creative studio"}</p>
        <h1 className="font-semibold leading-[1.02] tracking-[-0.04em]" style={{ fontSize: "clamp(2.3rem, 8vw, 5.5rem)", overflowWrap: "anywhere" }}>{c.title}</h1>
        <p className="mx-auto mt-5 max-w-lg text-sm opacity-70">{c.sub}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3"><button onClick={p.onScroll} className="inline-flex items-center gap-2 rounded-full bg-[var(--store-primary)] px-6 py-3 text-sm font-semibold text-[var(--store-on)] cursor-pointer">{c.cta}<ArrowRight className="h-4 w-4" /></button><button onClick={() => w.setOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-[var(--store-line)] bg-white/5 px-6 py-3 text-sm font-semibold cursor-pointer">▶ Wallet {w.text}</button></div>
        <div className="dz-bust mx-auto mt-10" aria-hidden />
      </section>
      <section ref={p.productsRef} className="mx-auto w-full max-w-7xl scroll-mt-4 px-4 sm:px-8 pb-16 pt-6">
        <Chips p={p} className="mb-8 justify-start md:justify-center" />
        <ProductGrid p={p} cols={Math.min(p.columns, 3)} />
      </section>
    </Frame>
  );
}

/** BLACKRIDGE: charcoal + cherry red, light-weight headline, nav with dropdown chevrons, bottom proof strip. */
export function Blackridge(p: DesignProps) {
  const c = useCopy(); const w = useWallet();
  return (
    <Frame w={w}>
      <header className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 sm:px-8 py-5">
        <span className="flex items-center gap-2"><i className="dz-chev" /><Brand name={c.name} textClass="text-lg font-semibold" /></span>
        <nav className="ml-auto hidden md:flex items-center gap-7 text-sm">{p.categoryIds.map((id) => <button key={id} onClick={() => { p.onCategory(id); p.onScroll(); }} className={`cursor-pointer ${id === p.active ? "text-[var(--store-fg)]" : "opacity-60 hover:opacity-100"}`}>{catName(id)} ⌄</button>)}</nav>
        <span className="flex-1 md:hidden" />
        <button onClick={() => w.setOpen(true)} className="rounded-full bg-[var(--store-accent)] px-4 py-2 text-xs font-semibold text-black cursor-pointer">{w.text}</button>
        <button onClick={p.onProfile} aria-label="Profile" className="grid h-9 w-9 place-items-center rounded-full border border-[var(--store-line)] cursor-pointer"><User className="h-4 w-4" /></button>
      </header>
      <div className="mx-auto flex w-full max-w-7xl justify-end px-4 sm:px-8"><AuthButtons /></div>
      <section className="relative mx-auto w-full max-w-7xl overflow-hidden px-4 sm:px-8 pt-12 pb-10">
        <div className="dz-roof" aria-hidden />
        <div className="relative max-w-xl min-w-0">
          <span className="inline-block rounded-full border border-[var(--store-line)] px-3 py-1 text-[11px] opacity-80">{c.tag || "Est. 2009"}</span>
          <h1 className="mt-5 font-light leading-[1.02] tracking-[-0.03em]" style={{ fontSize: "clamp(2.4rem, 8vw, 5rem)", overflowWrap: "anywhere" }}>{c.title}</h1>
          <p className="mt-5 max-w-md text-sm opacity-70">{c.sub}</p>
          <div className="mt-7 flex flex-wrap gap-3"><button onClick={p.onScroll} className="rounded-full bg-[var(--store-primary)] px-6 py-3 text-sm font-semibold text-[var(--store-on)] cursor-pointer">{c.cta}</button><button onClick={p.onProfile} className="rounded-full border border-[var(--store-line)] px-6 py-3 text-sm cursor-pointer">My account</button></div>
        </div>
        {c.stats && <ul className="relative mt-12 flex flex-wrap gap-x-8 gap-y-2 text-xs opacity-75">{STATS.map((s) => <li key={s.label} className="flex items-center gap-2"><b className="text-[var(--store-fg)]">{s.value}</b>{s.label}</li>)}</ul>}
      </section>
      <section ref={p.productsRef} className="mx-auto w-full max-w-7xl scroll-mt-4 px-4 sm:px-8 pb-16">
        <Chips p={p} className="mb-8 md:hidden" />
        <ProductGrid p={p} cols={Math.min(p.columns, 3)} />
      </section>
    </Frame>
  );
}

/** TIDEWELL: ink navy + pearl, glass droplet, and a FLOATING BOTTOM MENU DOCK (categories, wallet, profile). */
export function Tidewell(p: DesignProps) {
  const c = useCopy(); const w = useWallet();
  const dock = (
    <nav aria-label="Menu" className="fixed inset-x-0 bottom-3 z-[70] flex justify-center px-3">
      <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-[var(--store-line)] bg-[color:var(--store-surface)]/85 p-1.5 shadow-2xl backdrop-blur-xl">
        {p.categoryIds.map((id) => { const I = catIcon(id); const on = id === p.active; return (
          <button key={id} onClick={() => { p.onCategory(id); p.onScroll(); }} aria-label={catName(id)} className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2.5 text-xs font-bold cursor-pointer transition-all ${on ? "bg-[var(--store-primary)] text-[var(--store-on)]" : "opacity-75 hover:opacity-100"}`}><I className="h-4 w-4" />{on && catName(id)}</button>); })}
        <span className="mx-1 h-6 w-px shrink-0 bg-[var(--store-line)]" />
        <button onClick={() => w.setOpen(true)} aria-label="Wallet" className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-bold cursor-pointer"><Wallet className="h-4 w-4" />{w.text}</button>
        <button onClick={p.onProfile} aria-label="Profile" className="grid h-10 w-10 shrink-0 place-items-center rounded-full cursor-pointer"><User className="h-4 w-4" /></button>
      </div>
    </nav>
  );
  return (
    <Frame w={w} after={<div className="h-24" />}>
      {dock}
      <header className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 sm:px-8 py-5"><Brand name={c.name} size={34} rounded="rounded-xl" textClass="text-base tracking-tight" /><span className="ml-auto"><AuthButtons /></span></header>
      <section className="mx-auto grid w-full max-w-7xl items-center gap-8 px-4 sm:px-8 pt-8 pb-12 md:grid-cols-[1.15fr_1fr]">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--store-line)] bg-white/5 px-3.5 py-1.5 text-xs">⚡ {c.tag || "Instant delivery"}</span>
          <h1 className="mt-6 font-light leading-[1.02] tracking-[-0.035em]" style={{ fontSize: "clamp(2.4rem, 8.5vw, 5.4rem)", overflowWrap: "anywhere" }}>{c.title}</h1>
          <p className="mt-5 max-w-md text-sm opacity-75">{c.sub}</p>
          <div className="mt-7 flex flex-wrap gap-3"><button onClick={p.onScroll} className="rounded-full bg-[var(--store-primary)] px-6 py-3 text-sm font-semibold text-[var(--store-on)] cursor-pointer">{c.cta}</button><button onClick={() => w.setOpen(true)} className="rounded-full border border-[var(--store-line)] px-6 py-3 text-sm cursor-pointer">Add funds</button></div>
          {c.stats && <div className="mt-8 flex flex-wrap gap-2.5">{STATS.map((s) => { const I = s.icon; return <span key={s.label} className="inline-flex items-center gap-2 rounded-2xl border border-[var(--store-line)] bg-white/5 px-3.5 py-2 text-xs backdrop-blur"><I className="h-4 w-4 text-[var(--store-accent)]" /><b>{s.value}</b><span className="opacity-60">{s.label}</span></span>; })}</div>}
        </div>
        <div className="dz-drop mx-auto" aria-hidden />
      </section>
      <section ref={p.productsRef} className="mx-auto w-full max-w-7xl scroll-mt-4 px-4 sm:px-8 pb-10">
        <h2 className="mb-6 text-2xl font-light">{catName(p.active)}</h2>
        <ProductGrid p={p} cols={Math.min(p.columns, 3)} />
      </section>
    </Frame>
  );
}
