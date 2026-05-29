"use client";

import { MessageCircle } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background/50 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Logo & Info */}
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                <span className="text-lg font-bold text-primary">JP</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">JPRIME CHEATS</h3>
                <p className="text-xs text-muted-foreground">Premium FF Panel Purchase</p>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="flex flex-col items-center md:items-end gap-2">
            <p className="text-sm text-muted-foreground">Need help? Contact support</p>
            <a
              href="https://t.me/JPRIMEADMIN"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm font-medium">@JPRIMEADMIN</span>
            </a>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 pt-8 border-t border-border/30 text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} JPRIME CHEATS STORE. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
