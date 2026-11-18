"use client";

import { useEffect, useState } from "react";
import { Folder, FolderOpen, User, Wallet } from "lucide-react";
import { AuthButtons } from "@/components/auth-buttons";
import { StoreLogo } from "@/components/store-brand-mark";
import { Footer } from "@/components/footer";
import { FloatingSupport } from "@/components/floating-support";
import { type DesignProps, ProductGrid, STATS, WalletDialog, catName, useCopy, useWallet } from "./shared";

/** PIXEL 95: a retro desktop. One big window with a title bar, a folder list, and a taskbar fixed at the bottom. */
export function Pixel95(p: DesignProps) {
  const c = useCopy();
  const w = useWallet();
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick(); const t = setInterval(tick, 30000); return () => clearInterval(t);
  }, []);
  return (
    <div className="dz-p95 min-h-screen flex flex-col pb-14">
      <div className="mx-auto w-full max-w-7xl flex-1 px-2 sm:px-6 py-4 sm:py-8">
        <div className="p95-window">
          <div className="p95-title">
            <StoreLogo size={18} className="h-[18px] w-[18px] rounded-none" />
            <span className="flex-1 truncate">{c.name.toUpperCase().replace(/\s+/g, "_")}.EXE{c.tag ? ` - ${c.tag}` : ""}</span>
            <span className="p95-btn" aria-hidden>_</span><span className="p95-btn" aria-hidden>▢</span><span className="p95-btn" aria-hidden>✕</span>
          </div>
          <div className="p95-menu">
            <button onClick={() => w.setOpen(true)} className="p95-menu-item cursor-pointer"><Wallet className="inline h-3 w-3" /> Wallet {w.text}</button>
            <button onClick={p.onProfile} className="p95-menu-item cursor-pointer"><User className="inline h-3 w-3" /> Profile</button>
            <button onClick={p.onScroll} className="p95-menu-item cursor-pointer">Help</button>
          </div>

          <div className="p95-body">
            <aside className="p95-side">
              <p className="p95-label">Folders</p>
              <ul className="flex md:block gap-2 overflow-x-auto">
                {p.categoryIds.map((id) => {
                  const on = id === p.active; const I = on ? FolderOpen : Folder;
                  return (<li key={id} className="shrink-0"><button onClick={() => p.onCategory(id)} className={`p95-folder cursor-pointer ${on ? "is-on" : ""}`}><I className="h-5 w-5 shrink-0" /><span className="truncate">{catName(id)}</span></button></li>);
                })}
              </ul>
              {c.stats && (
                <div className="p95-inset mt-4 hidden md:block text-[11px] leading-5">
                  {STATS.map((s) => (<div key={s.label} className="flex justify-between gap-2"><span>{s.label}</span><b>{s.value}</b></div>))}
                </div>
              )}
            </aside>

            <div className="p95-main">
              <div className="p95-inset mb-4">
                <h1 className="text-xl sm:text-3xl font-black uppercase leading-tight">{c.title}</h1>
                <p className="mt-1 text-xs sm:text-sm opacity-80">{c.sub}</p>
                <button onClick={p.onScroll} className="p95-button mt-3 cursor-pointer">{c.cta}</button>
              </div>
              <div ref={p.productsRef} className="scroll-mt-4">
                <p className="p95-label mb-2">C:\{catName(p.active).toUpperCase()}\</p>
                <ProductGrid p={p} cols={Math.min(p.columns, 3)} gap="gap-4" />
              </div>
            </div>
          </div>
          <div className="p95-status"><span>{p.products.length} object(s)</span><span className="hidden sm:inline">Ready</span></div>
        </div>
        <div className="mt-6"><Footer /></div>
      </div>

      <div className="p95-taskbar">
        <div className="p95-start"><AuthButtons /></div>
        <button onClick={() => w.setOpen(true)} className="p95-task cursor-pointer"><Wallet className="h-4 w-4" />{w.text}</button>
        <span className="p95-task is-on hidden sm:flex"><FolderOpen className="h-4 w-4" />{catName(p.active)}</span>
        <span className="p95-tray">{time}</span>
      </div>
      <FloatingSupport />
      <WalletDialog w={w} />
    </div>
  );
}
