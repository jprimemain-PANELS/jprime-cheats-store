"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Menu, Smartphone, Monitor, Apple, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AuthButtons } from "./auth-buttons";
import { WalletModal } from "./wallet-modal";

interface NavbarProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

const categories = [
  { id: "mobile", label: "MOBILE PANEL", icon: Smartphone },
  { id: "pc", label: "PC PANEL", icon: Monitor },
  { id: "ios", label: "iOS PANEL", icon: Apple },
];

export function Navbar({ activeCategory, onCategoryChange }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const navRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleCategoryClick = (categoryId: string) => {
    onCategoryChange(categoryId);
    setIsOpen(false);
  };

  // Shrink + solidify the bar once the page scrolls
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    async function loadWallet() {
      const user = localStorage.getItem("user");

      if (!user) return;

      let parsed: any;
      try {
        parsed = JSON.parse(user);
      } catch {
        return;
      }

      const response = await fetch("/api/get-wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: parsed.username,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setWalletBalance(result.balance);
      }
    }

    loadWallet();
  }, []);

  // Track the active tab's position so the indicator can glide to it
  useEffect(() => {
    const measure = () => {
      const el = navRefs.current[activeCategory];
      if (el) {
        setIndicator({ left: el.offsetLeft, width: el.offsetWidth, opacity: 1 });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeCategory]);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300 ${
          scrolled
            ? "border-violet-500/15 bg-[#07040f]/95 backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]"
            : "border-white/5 bg-[#07040f]/70 backdrop-blur-md"
        }`}
      >
        {/* top highlight line */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/40 to-transparent" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            className={`flex items-center justify-between transition-all duration-300 ${
              scrolled ? "h-14" : "h-16"
            }`}
          >
            {/* Logo */}
            <div className="flex items-center gap-2 sm:gap-4 animate-in fade-in slide-in-from-left-2 duration-500">
              <AuthButtons />
              <Image
                src="/logo.png"
                alt="J Prime Panels"
                width={50}
                height={50}
                className="rounded-xl transition-transform duration-300 hover:scale-105 hover:rotate-2 w-9 h-9 sm:w-12 sm:h-12"
              />
              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold tracking-tight text-white">
                  JPRIME CHEATS
                </h1>
                <p className="text-xs text-white/50">Premium FF Panel</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-4">
              <button
                onClick={() => setWalletModalOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-fuchsia-500/25 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 px-4 py-2 hover:from-violet-500/20 hover:to-fuchsia-500/20 transition-all"
              >
                <Wallet className="h-4 w-4 text-fuchsia-400" />
                <div className="text-left">
                  <div className="text-[10px] text-fuchsia-300 uppercase">Wallet</div>
                  <div className="text-sm font-semibold text-white">
                    ₹{walletBalance?.toFixed(2) ?? "0.00"}
                  </div>
                </div>
              </button>

              <div className="relative flex items-center gap-1">
                <span
                  className="absolute inset-y-0 rounded-lg bg-gradient-to-r from-violet-500/15 to-fuchsia-500/15 border border-fuchsia-500/25 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{
                    left: indicator.left,
                    width: indicator.width,
                    opacity: indicator.opacity,
                  }}
                  aria-hidden="true"
                />
                {categories.map((category) => {
                  const Icon = category.icon;
                  const isActive = activeCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      ref={(el) => {
                        navRefs.current[category.id] = el;
                      }}
                      onClick={() => handleCategoryClick(category.id)}
                      className={`relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-300 ${
                        isActive ? "text-fuchsia-300" : "text-white/50 hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 transition-transform duration-300 ${
                          isActive ? "scale-110" : ""
                        }`}
                      />
                      {category.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile Actions Header */}
            <div className="flex md:hidden items-center gap-2">
              {/* Mobile Wallet Quick-Trigger Button */}
              <button
                onClick={() => setWalletModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-fuchsia-500/25 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 px-3 py-1.5 hover:from-violet-500/20 hover:to-fuchsia-500/20 transition-all"
              >
                <Wallet className="h-4 w-4 text-fuchsia-400" />
                <span className="text-xs font-semibold text-white">
                  ₹{walletBalance?.toFixed(2) ?? "0.00"}
                </span>
              </button>

              {/* Mobile Sheet Trigger */}
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white transition-transform active:scale-90 hover:bg-white/5"
                  >
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-72 bg-[#0b0714] border-violet-500/15"
                >
                  <div className="flex flex-col gap-6 pt-8">
                    <div className="flex items-center gap-3 px-2">
                      <Image
                        src="/logo.png"
                        alt="J Prime Panels"
                        width={50}
                        height={50}
                        className="rounded-xl"
                      />
                      <div>
                        <h2 className="text-lg font-semibold text-white">JPRIME CHEATS</h2>
                        <p className="text-xs text-white/50">Premium FF Panel</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {/* Wallet Option Inside Sheet Drawer */}
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          setWalletModalOpen(true);
                        }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border border-fuchsia-500/25 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 text-fuchsia-200 hover:from-violet-500/20 hover:to-fuchsia-500/20 transition-all"
                      >
                        <Wallet className="h-5 w-5 text-fuchsia-400" />
                        <span>Wallet: ₹{walletBalance?.toFixed(2) ?? "0.00"}</span>
                      </button>

                      {categories.map((category, i) => {
                        const Icon = category.icon;
                        const isActive = activeCategory === category.id;
                        return (
                          <button
                            key={category.id}
                            onClick={() => handleCategoryClick(category.id)}
                            style={{ animationDelay: `${i * 60}ms` }}
                            className={`animate-in fade-in slide-in-from-right-4 fill-mode-both flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 active:scale-[0.98] ${
                              isActive
                                ? "bg-gradient-to-r from-violet-500/15 to-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/25"
                                : "text-white/50 hover:text-white hover:bg-white/5"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                            {category.label}
                            {isActive && (
                              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>

      <WalletModal
        open={walletModalOpen}
        onOpenChange={setWalletModalOpen}
        balance={walletBalance ?? 0}
        onBalanceUpdate={setWalletBalance}
      />
    </>
  );
}