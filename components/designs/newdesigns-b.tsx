"use client";

import { ArrowRight, ArrowUpRight, User, Wallet } from "lucide-react";
import { AuthButtons } from "@/components/auth-buttons";
import { Brand, Frame, splitTitle } from "./parts";
import { type DesignProps, ProductGrid, STATS, catIcon, catName, pad2, useCopy, useWallet } from "./shared";

const pill = (on: boolean) => `shrink-0 rounded-full border px-4 py-2 text-xs sm:text-sm font-semibold cursor-pointer transition-colors ${on ? "border-transparent bg-[var(--store-primary)] text-[var(--store-on)]" : "border-[var(--store-line)] hover:border-[var(--store-primary)]"}`;
const Chips = ({ p, className = "" }: { p: DesignProps; className?: string }) => (
  <nav aria-label="Categories" className={`flex gap-2 overflow-x-auto pb-1 ${className}`}>
    {p.categoryIds.map((id) => { const I = catIcon(id); return <button key={id} onClick={() => p.onCategory(id)} className={`${pill(id === p.active)} inline-flex items-center gap-2`}><I className="h-4 w-4" />{catName(id)}</button>; })}
  </nav>
);

/** CORAL TIDE: warm cream, coral wave band, rounded centre nav card, outline hero with chunky pill buttons. */
export function CoralTide(p: DesignProps) {
  const c = useCopy(); const w = useWallet();
  return (
    <Frame w={w}>
      <header className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 sm:px-8 pt-4">
        <div className="flex w-full items-center gap-3 rounded-full border border-[var(--store-line)] bg-[var(--store-surface)] px-4 py-2.5 shadow-sm">
          <Brand name={c.name} rounded="rounded-full" textClass="text-sm" />
          <nav className="mx-auto hidden md:flex gap-6 text-sm font-semibold">{p.categoryIds.map((id) => <button key={id} onClick={() => { p.onCategory(id); p.onScroll(); }} className={`cursor-pointer ${id === p.active ? "text-[var(--store-primary)]" : "opacity-70 hover:opacity-100"}`}>{catName(id)}</button>)}</nav>
          <span className="flex-1 md:hidden" />
          <button onClick={() => w.setOpen(true)} className="rounded-full bg-[var(--store-primary)] px-4 py-2 text-xs font-bold text-[var(--store-on)] cursor-pointer">{w.text}</button>
          <button onClick={p.onProfile} aria-label="Profile" className="grid h-9 w-9 place-items-center rounded-full border border-[var(--store-line)] cursor-pointer"><User className="h-4 w-4" /></button>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl justify-end px-4 sm:px-8 pt-2"><AuthButtons /></div>
      <section className="relative mx-auto w-full max-w-6xl overflow-hidden px-4 sm:px-8 pt-10 pb-16 text-center">
        <div className="dz-tide" aria-hidden />
        <p className="relative mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--store-primary)]">{c.tag || "Fresh every day"}</p>
        <h1 className="relative mx-auto max-w-4xl font-extrabold leading-[0.98] tracking-[-0.04em]" style={{ fontSize: "clamp(2.5rem, 9vw, 6rem)", overflowWrap: "anywhere" }}>{c.title}</h1>
        <p className="relative mx-auto mt-5 max-w-md text-sm opacity-75">{c.sub}</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3"><button onClick={p.onScroll} className="inline-flex items-center gap-2 rounded-full bg-[var(--store-primary)] px-7 py-3.5 text-sm font-bold text-[var(--store-on)] shadow-lg cursor-pointer">{c.cta}<ArrowRight className="h-4 w-4" /></button><button onClick={() => w.setOpen(true)} className="rounded-full border-2 border-[var(--store-fg)] px-7 py-3.5 text-sm font-bold cursor-pointer">Add funds</button></div>
        {c.stats && <ul className="relative mt-10 flex flex-wrap justify-center gap-3">{STATS.map((s) => <li key={s.label} className="rounded-full border border-[var(--store-line)] bg-[var(--store-surface)] px-4 py-2 text-xs font-bold">{s.value} <span className="opacity-60">{s.label}</span></li>)}</ul>}
      </section>
      <section ref={p.productsRef} className="mx-auto w-full max-w-6xl scroll-mt-4 px-4 sm:px-8 pb-16">
        <Chips p={p} className="mb-8 md:justify-center" />
        <ProductGrid p={p} cols={Math.min(p.columns, 3)} />
      </section>
    </Frame>
  );
}

/** MOSSGROVE: deep forest green, floating glass nav capsule, left-aligned hero with a glowing moss orb, glass cards. */
export function Mossgrove(p: DesignProps) {
  const c = useCopy(); const w = useWallet();
  return (
    <Frame w={w}>
      <header className="sticky top-3 z-50 mx-auto w-full max-w-5xl px-3">
        <div className="flex items-center gap-3 rounded-full border border-[var(--store-line)] bg-[color:var(--store-surface)]/70 px-4 py-2.5 backdrop-blur-xl">
          <Brand name={c.name} rounded="rounded-full" textClass="text-sm" />
          <nav className="mx-auto hidden md:flex gap-1">{p.categoryIds.map((id) => <button key={id} onClick={() => { p.onCategory(id); p.onScroll(); }} className={`rounded-full px-4 py-1.5 text-xs font-semibold cursor-pointer ${id === p.active ? "bg-[var(--store-primary)] text-[var(--store-on)]" : "opacity-70 hover:opacity-100"}`}>{catName(id)}</button>)}</nav>
          <span className="flex-1 md:hidden" />
          <button onClick={() => w.setOpen(true)} className="flex items-center gap-1.5 text-xs font-bold cursor-pointer"><Wallet className="h-4 w-4" />{w.text}</button>
          <button onClick={p.onProfile} aria-label="Profile" className="grid h-8 w-8 place-items-center rounded-full border border-[var(--store-line)] cursor-pointer"><User className="h-4 w-4" /></button>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-5xl justify-end px-4 pt-2"><AuthButtons /></div>
      <section className="relative mx-auto grid w-full max-w-6xl items-center gap-8 px-4 sm:px-8 pt-12 pb-14 md:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0">
          <span className="inline-flex rounded-full border border-[var(--store-line)] bg-white/5 px-3.5 py-1.5 text-xs">🌿 {c.tag || "Grown with care"}</span>
          <h1 className="mt-6 font-semibold leading-[1.02] tracking-[-0.035em]" style={{ fontSize: "clamp(2.4rem, 8.5vw, 5.4rem)", overflowWrap: "anywhere" }}>{c.title}</h1>
          <p className="mt-5 max-w-md text-sm opacity-75">{c.sub}</p>
          <button onClick={p.onScroll} className="mt-7 inline-flex items-center gap-2 rounded-full bg-[var(--store-primary)] px-7 py-3.5 text-sm font-bold text-[var(--store-on)] cursor-pointer">{c.cta}<ArrowUpRight className="h-4 w-4" /></button>
        </div>
        <div className="dz-moss mx-auto" aria-hidden />
      </section>
      {c.stats && <ul className="mx-auto mb-10 grid w-full max-w-5xl grid-cols-3 gap-3 px-4">{STATS.map((s) => { const I = s.icon; return <li key={s.label} className="rounded-3xl border border-[var(--store-line)] bg-white/5 p-4 text-center backdrop-blur"><I className="mx-auto mb-1 h-5 w-5 text-[var(--store-primary)]" /><b className="block text-sm">{s.value}</b><span className="text-[11px] opacity-60">{s.label}</span></li>; })}</ul>}
      <section ref={p.productsRef} className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 sm:px-8 pb-16">
        <Chips p={p} className="mb-8 md:hidden" />
        <ProductGrid p={p} cols={Math.min(p.columns, 3)} />
      </section>
    </Frame>
  );
}

/** FOREST: deep green, serif headline, split layout with a vertical category rail on the left (desktop). */
export function Forest(p: DesignProps) {
  const c = useCopy(); const w = useWallet(); const [a, b] = splitTitle(c.title);
  return (
    <Frame w={w}>
      <header className="mx-auto flex w-full max-w-7xl items-center gap-3 border-b border-[var(--store-line)] px-4 sm:px-8 py-4">
        <Brand name={c.name} textClass="dz-serif text-lg font-semibold" />
        <span className="flex-1" />
        <AuthButtons />
        <button onClick={() => w.setOpen(true)} className="rounded-md border border-[var(--store-line)] px-3.5 py-2 text-xs font-bold cursor-pointer">{w.text}</button>
        <button onClick={p.onProfile} aria-label="Profile" className="grid h-9 w-9 place-items-center rounded-md border border-[var(--store-line)] cursor-pointer"><User className="h-4 w-4" /></button>
      </header>
      <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-8 pt-10 pb-12 md:grid-cols-[210px_1fr]">
        <aside className="hidden md:block">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] opacity-60">Browse</p>
          <ul className="border-l border-[var(--store-line)]">{p.categoryIds.map((id, i) => <li key={id}><button onClick={() => { p.onCategory(id); p.onScroll(); }} className={`-ml-px block w-full border-l-2 py-3 pl-4 text-left text-sm cursor-pointer ${id === p.active ? "border-[var(--store-primary)] font-bold text-[var(--store-primary)]" : "border-transparent opacity-70 hover:opacity-100"}`}><span className="mr-2 text-xs opacity-50">{pad2(i + 1)}</span>{catName(id)}</button></li>)}</ul>
        </aside>
        <div className="min-w-0">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--store-primary)]">{c.tag || "Rooted in quality"}</p>
          <h1 className="dz-serif leading-[0.98] tracking-[-0.03em]" style={{ fontSize: "clamp(2.6rem, 9vw, 6rem)", overflowWrap: "anywhere" }}>{a}{b && <> <em className="text-[var(--store-primary)]">{b}</em></>}</h1>
          <p className="mt-5 max-w-lg text-sm opacity-75">{c.sub}</p>
          <button onClick={p.onScroll} className="mt-7 inline-flex items-center gap-2 rounded-md bg-[var(--store-primary)] px-7 py-3.5 text-sm font-bold text-[var(--store-on)] cursor-pointer">{c.cta}<ArrowRight className="h-4 w-4" /></button>
          {c.stats && <ul className="mt-10 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-[var(--store-line)] bg-[var(--store-line)]">{STATS.map((s) => <li key={s.label} className="bg-[var(--store-surface)] p-4"><b className="dz-serif block text-xl">{s.value}</b><span className="text-[11px] opacity-60">{s.label}</span></li>)}</ul>}
        </div>
      </section>
      <section ref={p.productsRef} className="mx-auto w-full max-w-7xl scroll-mt-4 px-4 sm:px-8 pb-16">
        <Chips p={p} className="mb-8 md:hidden" />
        <ProductGrid p={p} cols={Math.min(p.columns, 3)} />
      </section>
    </Frame>
  );
}

/** CRIMSON: black + red, huge slide numbering, slanted red block, bold uppercase, numbered category tabs. */
export function Crimson(p: DesignProps) {
  const c = useCopy(); const w = useWallet();
  return (
    <Frame w={w}>
      <header className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 sm:px-8 py-4">
        <Brand name={c.name} rounded="rounded-none" textClass="text-sm font-black uppercase tracking-[0.2em]" />
        <span className="flex-1" />
        <AuthButtons />
        <button onClick={() => w.setOpen(true)} className="bg-[var(--store-primary)] px-4 py-2 text-xs font-black uppercase tracking-wider text-[var(--store-on)] cursor-pointer">{w.text}</button>
        <button onClick={p.onProfile} aria-label="Profile" className="grid h-9 w-9 place-items-center border border-[var(--store-line)] cursor-pointer"><User className="h-4 w-4" /></button>
      </header>
      <section className="relative mx-auto w-full max-w-7xl overflow-hidden px-4 sm:px-8 pt-10 pb-12">
        <span className="dz-bignum" aria-hidden>01</span>
        <div className="relative max-w-3xl min-w-0">
          <p className="mb-4 inline-block bg-[var(--store-primary)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.3em] text-[var(--store-on)]">{c.tag || "Built different"}</p>
          <h1 className="font-black uppercase leading-[0.92] tracking-[-0.03em]" style={{ fontSize: "clamp(2.6rem, 10vw, 6.8rem)", overflowWrap: "anywhere" }}>{c.title}</h1>
          <p className="mt-5 max-w-md text-sm opacity-75">{c.sub}</p>
          <button onClick={p.onScroll} className="mt-7 inline-flex items-center gap-3 border-2 border-[var(--store-primary)] px-7 py-3.5 text-xs font-black uppercase tracking-widest hover:bg-[var(--store-primary)] hover:text-[var(--store-on)] transition-colors cursor-pointer">{c.cta}<ArrowRight className="h-4 w-4" /></button>
        </div>
        {c.stats && <ul className="relative mt-10 flex flex-wrap gap-x-10 gap-y-3 border-t border-[var(--store-line)] pt-5">{STATS.map((s, i) => <li key={s.label} className="text-xs font-bold uppercase tracking-wider"><span className="mr-2 text-[var(--store-primary)]">{pad2(i + 1)}</span>{s.label}</li>)}</ul>}
      </section>
      <section ref={p.productsRef} className="mx-auto w-full max-w-7xl scroll-mt-4 px-4 sm:px-8 pb-16">
        <nav aria-label="Categories" className="mb-8 flex gap-6 overflow-x-auto border-b border-[var(--store-line)]">{p.categoryIds.map((id, i) => <button key={id} onClick={() => p.onCategory(id)} className={`shrink-0 border-b-4 pb-3 text-sm font-black uppercase tracking-wider cursor-pointer ${id === p.active ? "border-[var(--store-primary)]" : "border-transparent opacity-60"}`}><span className="mr-2 text-[var(--store-primary)]">{pad2(i + 1)}</span>{catName(id)}</button>)}</nav>
        <ProductGrid p={p} cols={Math.min(p.columns, 3)} />
      </section>
    </Frame>
  );
}

/** SERENE: warm sand, thin serif headline, vertical numerals down the side, calm minimal text menu. */
export function Serene(p: DesignProps) {
  const c = useCopy(); const w = useWallet();
  return (
    <Frame w={w}>
      <header className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 sm:px-8 py-6">
        <Brand name={c.name} rounded="rounded-full" textClass="dz-serif text-lg font-normal tracking-wide" />
        <nav className="mx-auto hidden md:flex gap-9 text-xs uppercase tracking-[0.25em]">{p.categoryIds.map((id) => <button key={id} onClick={() => { p.onCategory(id); p.onScroll(); }} className={`cursor-pointer pb-1 ${id === p.active ? "border-b border-[var(--store-fg)]" : "opacity-60 hover:opacity-100"}`}>{catName(id)}</button>)}</nav>
        <span className="flex-1 md:hidden" />
        <button onClick={() => w.setOpen(true)} className="text-xs uppercase tracking-[0.2em] cursor-pointer">{w.text}</button>
        <button onClick={p.onProfile} aria-label="Profile" className="grid h-9 w-9 place-items-center rounded-full border border-[var(--store-line)] cursor-pointer"><User className="h-4 w-4" /></button>
      </header>
      <div className="mx-auto flex w-full max-w-7xl justify-end px-4 sm:px-8"><AuthButtons /></div>
      <section className="relative mx-auto w-full max-w-7xl px-4 sm:px-8 pt-12 pb-16">
        <ul className="absolute right-4 top-12 hidden sm:flex flex-col gap-4 text-[11px] tracking-[0.3em] opacity-50 [writing-mode:vertical-rl]">{p.categoryIds.map((id, i) => <li key={id}>{pad2(i + 1)} — {catName(id)}</li>)}</ul>
        <div className="max-w-3xl min-w-0 sm:pr-16">
          <p className="mb-5 text-[11px] uppercase tracking-[0.4em] opacity-60">{c.tag || "Slow & simple"}</p>
          <h1 className="dz-serif font-light leading-[1.02] tracking-[-0.025em]" style={{ fontSize: "clamp(2.6rem, 9vw, 6rem)", overflowWrap: "anywhere" }}>{c.title}</h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed opacity-70">{c.sub}</p>
          <div className="mt-8 flex flex-wrap items-center gap-6"><button onClick={p.onScroll} className="rounded-full bg-[var(--store-primary)] px-8 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--store-on)] cursor-pointer">{c.cta}</button>{c.stats && <span className="text-xs opacity-60">{STATS.map((s) => s.label).join(" · ")}</span>}</div>
        </div>
      </section>
      <section ref={p.productsRef} className="mx-auto w-full max-w-7xl scroll-mt-4 px-4 sm:px-8 pb-16">
        <Chips p={p} className="mb-8 md:hidden" />
        <ProductGrid p={p} cols={Math.min(p.columns, 3)} />
      </section>
    </Frame>
  );
}
