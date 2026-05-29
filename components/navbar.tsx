"use client";

import { useState } from "react";
import { Menu, X, Smartphone, Monitor, Apple } from "lucide-react";
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

  const handleCategoryClick = (categoryId: string) => {
    onCategoryChange(categoryId);
    setIsOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
          <AuthButtons />
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <span className="text-lg font-bold text-primary">JP</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                JPRIME CHEATS
              </h1>
              <p className="text-xs text-muted-foreground">Premium FF Panel</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    activeCategory === category.id
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {category.label}
                </button>
              );
            })}
          </div>

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="text-foreground">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background border-border">
              <div className="flex flex-col gap-6 pt-8">
                <div className="flex items-center gap-3 px-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                    <span className="text-lg font-bold text-primary">JP</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">JPRIME CHEATS</h2>
                    <p className="text-xs text-muted-foreground">Premium FF Panel</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {categories.map((category) => {
                    const Icon = category.icon;
                    return (
                      <button
                        key={category.id}
                        onClick={() => handleCategoryClick(category.id)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                          activeCategory === category.id
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {category.label}
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
