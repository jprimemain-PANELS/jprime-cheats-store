"use client";

import Image from "next/image";
import { useBrand } from "@/components/brand-provider";

/** Store logo: the owner keeps /logo.png; a co-admin shows their own https logo, else their initials. */
export function StoreLogo({ size = 50, className = "" }: { size?: number; className?: string }) {
  const b = useBrand();
  if (b.isOwner) {
    return <Image src="/logo.png" alt={b.name} width={size} height={size} className={className} />;
  }
  if (b.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={b.logoUrl} alt={b.name} width={size} height={size} referrerPolicy="no-referrer" className={`${className} object-contain`} />;
  }
  const initials = b.name.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "S";
  return (
    <div
      style={{ width: size, height: size }}
      className={`${className} flex items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 border border-fuchsia-500/25 font-bold text-fuchsia-300`}
    >
      {initials}
    </div>
  );
}
