"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { Apple, Monitor, Package, ShieldCheck, Smartphone, Users, Zap } from "lucide-react";
import type { Product } from "@/lib/products";
import { categoryLabel } from "@/lib/categories";
import { WalletModal } from "@/components/wallet-modal";
import { useBrand } from "@/components/brand-provider";

/** Everything a store design needs. The buying logic itself stays in ProductCard / GuildGloryCard (renderProduct). */
export type DesignProps = {
  categoryIds: string[];
  active: string;
  onCategory: (id: string) => void;
  products: Product[];
  loading: boolean;
  renderProduct: (p: Product, i: number) => ReactNode;
  productsRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onProfile: () => void;
  username: string;
  columns: number;
};

const ICONS: Record<string, any> = { mobile: Smartphone, pc: Monitor, ios: Apple };
export const catIcon = (id: string) => ICONS[id] ?? Package;
export const catName = (id: string) => categoryLabel(id);
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const STATS = [
  { icon: Users, value: "10,000+", label: "Users" },
  { icon: ShieldCheck, value: "Trusted", label: "Verified" },
  { icon: Zap, value: "Instant", label: "Auto delivery" },
];

/** Wallet balance + the add-money dialog (same endpoints the classic navbar uses). */
export function useWallet() {
  const [balance, setBalance] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const raw = localStorage.getItem("user");
        if (!raw) return;
        const u = JSON.parse(raw);
        const r = await fetch("/api/get-wallet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u.username }) });
        const j = await r.json();
        if (live && j?.success) setBalance(Number(j.balance));
      } catch {}
    })();
    const onBal = (e: Event) => { const b = Number((e as CustomEvent).detail?.balance); if (Number.isFinite(b)) setBalance(b); };
    window.addEventListener("wallet-balance-updated", onBal);
    return () => { live = false; window.removeEventListener("wallet-balance-updated", onBal); };
  }, []);
  return { balance, setBalance, open, setOpen, text: `₹${(balance ?? 0).toFixed(2)}` };
}
export type WalletApi = ReturnType<typeof useWallet>;
export function WalletDialog({ w }: { w: WalletApi }) {
  return <WalletModal open={w.open} onOpenChange={w.setOpen} balance={w.balance ?? 0} onBalanceUpdate={w.setBalance} />;
}

/** Headline / subtitle / button text: the store's own hero settings first, otherwise sensible defaults. */
export function useCopy() {
  const brand = useBrand();
  const L = brand.layout;
  const own = !brand.isOwner;
  return {
    name: brand.name,
    title: (own && L.heroTitle) || brand.name,
    sub: (own && L.heroSubtitle) || brand.tagline || "Instant delivery, secure payments and friendly support.",
    cta: L.ctaText || "Browse products",
    tag: brand.isOwner ? "Premium FF Panel" : brand.tagline,
    stats: own ? L.showStats : true,
  };
}

const GRID: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};
export const gridCols = (n: number, max = 4) => GRID[Math.min(n, max)] ?? GRID[3];

/** Loading spinner / empty message / the grid of cards. `wrap` lets a design add its own frame around each card. */
export function ProductGrid({ p, cols, className = "", gap = "gap-6 sm:gap-8", wrap }: { p: DesignProps; cols?: number; className?: string; gap?: string; wrap?: (card: ReactNode, product: Product, i: number) => ReactNode }) {
  if (p.loading) return <div className="py-16 flex justify-center"><div className="dz-spin h-8 w-8 rounded-full border-2 border-white/10 border-t-[var(--store-accent)]" /></div>;
  if (!p.products.length) return <div className="mx-auto max-w-xl rounded-2xl border border-white/10 px-6 py-12 text-center text-sm opacity-70">No {catName(p.active)} products available yet.</div>;
  return (
    <div className={`grid ${gridCols(cols ?? p.columns)} ${gap} ${className}`}>
      {p.products.map((product, i) => {
        const card = p.renderProduct(product, i);
        return <div key={product.id} className="dz-rise min-w-0" style={{ animationDelay: `${Math.min(i, 8) * 0.06}s` }}>{wrap ? wrap(card, product, i) : card}</div>;
      })}
    </div>
  );
}
