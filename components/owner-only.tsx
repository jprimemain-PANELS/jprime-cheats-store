"use client";

import { useBrand } from "@/components/brand-provider";

/** Platform legal/marketing pages belong to the owner store only; other stores show a neutral message. */
export function OwnerOnly({ children }: { children: React.ReactNode }) {
  const b = useBrand();
  if (b.isOwner) return <>{children}</>;
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center text-white/70">
      <p>This page is not available.</p>
    </div>
  );
}
