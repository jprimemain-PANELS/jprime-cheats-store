"use client";

import { MessageCircle } from "lucide-react";

export function FloatingSupport() {
  return (
    <a
      href="https://t.me/JPRIMEADMIN"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(0,200,255,0.3)]"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="text-sm font-medium hidden sm:inline">Support</span>
    </a>
  );
}
