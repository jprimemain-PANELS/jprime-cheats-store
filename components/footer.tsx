"use client";

import Link from "next/link";
import { Instagram, MessageCircle, Phone, Youtube } from "lucide-react";
import { useBrand } from "./brand-provider";
import { StoreLogo } from "./store-brand-mark";

export function Footer() {
  const brand = useBrand();
  return (
    <footer className="relative border-t border-violet-500/15 bg-[#07040f]/80 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/40 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">

        {/* Top Section */}
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-10">

          {/* Logo */}
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-3">
              {brand.isOwner ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-fuchsia-500/25">
                  <span className="text-lg font-bold text-fuchsia-300">JP</span>
                </div>
              ) : (
                <StoreLogo size={40} className="h-10 w-10 rounded-xl" />
              )}

              <div>
                <h3 className="text-lg font-semibold text-white">
                  {brand.name}
                </h3>
                <p className="text-xs text-white/50">
                  {brand.isOwner ? "Premium FF Panel Store" : brand.tagline}
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
              {brand.telegram && (<a
                href={`https://t.me/${brand.telegram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 text-fuchsia-400 hover:text-fuchsia-300 transition-colors"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/25 group-hover:bg-fuchsia-500/20 group-hover:border-fuchsia-500/40 transition-colors">
                  <MessageCircle className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm font-medium">@{brand.telegram}</span>
              </a>)}

              {!brand.isOwner && brand.social?.whatsapp && (<a href={`https://wa.me/${brand.social.whatsapp}`} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20"><Phone className="h-3.5 w-3.5" /></span>
                <span className="text-sm font-medium">WhatsApp</span>
              </a>)}
              {brand.social?.instagram && (<a href={`https://instagram.com/${brand.social.instagram}`} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 text-pink-400 hover:text-pink-300 transition-colors">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-500/10 border border-pink-500/20"><Instagram className="h-3.5 w-3.5" /></span>
                <span className="text-sm font-medium">@{brand.social.instagram}</span>
              </a>)}
              {brand.social?.youtube && (<a href={brand.social.youtube} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20"><Youtube className="h-3.5 w-3.5" /></span>
                <span className="text-sm font-medium">YouTube</span>
              </a>)}

              {brand.isOwner && (<a
                href="https://wa.me/917200817883"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/15 group-hover:border-emerald-500/30 transition-colors">
                  <Phone className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm font-medium">+91 72008 17883</span>
              </a>)}
            </div>
          </div>
        </div>

        {/* Policy Links */}
        <div className="mt-10 pt-6 border-t border-white/5">
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/50">
            <Link href="/" className="hover:text-fuchsia-400 transition-colors">
              Home
            </Link>
            {brand.isOwner && (<Link href="/refund-policy" className="hover:text-fuchsia-400 transition-colors">Refunds</Link>)}
            {brand.isOwner && (<Link href="/terms" className="hover:text-fuchsia-400 transition-colors">Terms</Link>)}
            {brand.isOwner && (<Link href="/privacy" className="hover:text-fuchsia-400 transition-colors">Privacy</Link>)}
            {brand.isOwner && (<Link href="/official-platform" className="hover:text-fuchsia-400 transition-colors">Official Platform</Link>)}
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 pt-8 border-t border-white/5 text-center">
          <p className="text-sm text-white/50">
            © {new Date().getFullYear()} {brand.isOwner ? "JPRIME CHEATS STORE" : brand.name}. All rights reserved.
          </p>
          <p className="mt-2 text-xs text-white/30">
            {brand.footerText || "Secure Digital Product Delivery Platform"}
          </p>
        </div>

      </div>
      {brand.social?.floatingChat && (brand.social.whatsapp || brand.telegram) && (
        <a
          href={brand.social.whatsapp ? `https://wa.me/${brand.social.whatsapp}` : `https://t.me/${brand.telegram}`}
          target="_blank" rel="noopener noreferrer" aria-label="Chat with us"
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-black/40 transition-transform hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
        </a>
      )}
    </footer>
  );
}