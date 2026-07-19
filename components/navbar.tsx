"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Menu, Smartphone, Monitor, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AuthButtons } from "./auth-buttons";

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
    <nav
      className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300 ${
        scrolled
          ? "border-border/60 bg-background/95 backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.4)]"
          : "border-border/30 bg-background/70 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={`flex items-center justify-between transition-all duration-300 ${
            scrolled ? "h-14" : "h-16"
          }`}
        >
          {/* Logo */}
          <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2 duration-500">
            <AuthButtons />
            <Image
              src="/logo.png"
              alt="J Prime Panels"
              width={50}
              height={50}
              className="rounded-xl transition-transform duration-300 hover:scale-105 hover:rotate-2"
            />
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                JPRIME CHEATS
              </h1>
              <p className="text-xs text-muted-foreground">Premium FF Panel</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="relative hidden md:flex items-center gap-1">
            <span
              className="absolute inset-y-0 rounded-lg bg-primary/10 border border-primary/20 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
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
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
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

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="text-foreground transition-transform active:scale-90"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background border-border">
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
                    <h2 className="text-lg font-semibold text-foreground">JPRIME CHEATS</h2>
                    <p className="text-xs text-muted-foreground">Premium FF Panel</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
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
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {category.label}
                        {isActive && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
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
    </nav>
  );
}