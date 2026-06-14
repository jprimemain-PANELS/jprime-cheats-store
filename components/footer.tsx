"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";

export function Footer() {
return ( <footer className="border-t border-border/50 bg-background/50 backdrop-blur-sm"> <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">

```
    {/* Top Section */}
    <div className="flex flex-col md:flex-row items-center justify-between gap-8">

      {/* Logo */}
      <div className="flex flex-col items-center md:items-start gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <span className="text-lg font-bold text-cyan-400">JP</span>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-foreground">
              JPRIME CHEATS
            </h3>

            <p className="text-xs text-muted-foreground">
              Premium FF Panel Store
            </p>
          </div>
        </div>
      </div>

      {/* Telegram */}
      <div className="flex flex-col items-center md:items-end gap-2">
        <p className="text-sm text-muted-foreground">
          Need help? Contact support
        </p>

        <a
          href="https://t.me/JPRIMEADMIN"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm font-medium">
            @JPRIMEADMIN
          </span>
        </a>
      </div>
    </div>

    {/* Policy Links */}
    <div className="mt-8 pt-6 border-t border-border/30">
      <div className="flex flex-wrap justify-center gap-5 text-xs text-muted-foreground">

        <Link href="/" className="hover:text-cyan-400 transition-colors">
          Home
        </Link>

        <Link
          href="/refund-policy"
          className="hover:text-cyan-400 transition-colors"
        >
          Refunds
        </Link>

        <Link
          href="/terms"
          className="hover:text-cyan-400 transition-colors"
        >
          Terms
        </Link>

        <Link
          href="/privacy"
          className="hover:text-cyan-400 transition-colors"
        >
          Privacy
        </Link>

        <Link
          href="/official-platform"
          className="hover:text-cyan-400 transition-colors"
        >
          Official Platform
        </Link>

      </div>
    </div>

    {/* Bottom */}
    <div className="mt-8 pt-8 border-t border-border/30 text-center">
      <p className="text-sm text-muted-foreground">
        © {new Date().getFullYear()} JPRIME CHEATS STORE. All rights reserved.
      </p>

      <p className="mt-2 text-xs text-muted-foreground/70">
        Secure Digital Product Delivery Platform
      </p>
    </div>

  </div>
</footer>
);
}
