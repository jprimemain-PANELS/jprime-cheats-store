"use client";

import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative border-t border-violet-500/15 bg-[#07040f]/80 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/40 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">

        {/* Top Section */}
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-10">

          {/* Logo */}
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-fuchsia-500/25">
                <span className="text-lg font-bold text-fuchsia-300">JP</span>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white">
                  JPRIME CHEATS
                </h3>
                <p className="text-xs text-white/50">
                  Premium FF Panel Store
                </p>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="flex flex-col items-center md:items-end gap-3">
            <p className="text-sm text-white/50">
              Need help? Contact support
            </p>

            <div className="flex flex-col items-center md:items-end gap-2.5">
              <a
                href="https://t.me/JPRIMEADMIN"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 text-fuchsia-400 hover:text-fuchsia-300 transition-colors"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/25 group-hover:bg-fuchsia-500/20 group-hover:border-fuchsia-500/40 transition-colors">
                  <MessageCircle className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm font-medium">@JPRIMEADMIN</span>
              </a>

              <a
                href="https://wa.me/917200817883"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/15 group-hover:border-emerald-500/30 transition-colors">
                  <Phone className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm font-medium">+91 72008 17883</span>
              </a>
            </div>
          </div>
        </div>

        {/* Policy Links */}
        <div className="mt-10 pt-6 border-t border-white/5">
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/50">
            <Link href="/" className="hover:text-fuchsia-400 transition-colors">
              Home
            </Link>
            <Link href="/refund-policy" className="hover:text-fuchsia-400 transition-colors">
              Refunds
            </Link>
            <Link href="/terms" className="hover:text-fuchsia-400 transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-fuchsia-400 transition-colors">
              Privacy
            </Link>
            <Link href="/official-platform" className="hover:text-fuchsia-400 transition-colors">
              Official Platform
            </Link>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 pt-8 border-t border-white/5 text-center">
          <p className="text-sm text-white/50">
            © {new Date().getFullYear()} JPRIME CHEATS STORE. All rights reserved.
          </p>
          <p className="mt-2 text-xs text-white/30">
            Secure Digital Product Delivery Platform
          </p>
        </div>

      </div>
    </footer>
  );
}