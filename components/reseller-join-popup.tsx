"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, X } from "lucide-react";
import { useBrand } from "@/components/brand-provider";

/** Centre pop-up after login (main store, normal users only). Once per browser session. Click -> profile page (reseller upgrade). */
export function ResellerJoinPopup({ role }: { role?: string }) {
  const router = useRouter();
  const brand = useBrand();
  const [open, setOpen] = useState(false);
  const eligible = brand.isOwner && brand.options.upgradeOn && String(role ?? "").trim().toLowerCase() === "user";

  useEffect(() => {
    if (!eligible) return;
    try { if (sessionStorage.getItem("reseller-popup-seen")) return; } catch {}
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [eligible]);

  const close = () => { setOpen(false); try { sessionStorage.setItem("reseller-popup-seen", "1"); } catch {} };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={close} role="dialog" aria-modal="true">
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl border border-amber-400/40 bg-[#14110a] p-6 text-center shadow-[0_0_60px_-12px_rgba(251,191,36,0.5)]">
        <button onClick={close} aria-label="Close" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white cursor-pointer"><X className="h-4 w-4" /></button>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-black"><Crown className="h-7 w-7" /></span>
        <h2 className="mt-4 text-xl font-extrabold text-white">Join the Reseller</h2>
        <p className="mt-2 text-sm text-zinc-300">Activate reseller on your account, grow with your own brand and earn more.</p>
        <button onClick={() => { close(); router.push("/profile"); }} className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-bold text-black cursor-pointer">Click to join reseller</button>
        <button onClick={close} className="mt-2 text-xs text-zinc-400 cursor-pointer">Maybe later</button>
      </div>
    </div>
  );
}
