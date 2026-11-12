"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { ChangePasswordButton } from "@/components/change-password";
import { useBrand } from "@/components/brand-provider";

export function AuthButtons({ className = "" }: { className?: string }) {
  const router = useRouter();
  const brand = useBrand();

  const [isAdmin, setIsAdmin] = useState(false);
  const [canLaunch, setCanLaunch] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  // The role comes from the server-verified session, not from the browser.
  async function checkAdmin() {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const json = await res.json();

      const role = String(json?.user?.role ?? "").toLowerCase();
      if (json?.success && (role === "admin" || role === "coadmin")) {
        setIsAdmin(true);
      }
      if (json?.success && ["reseller", "vip_reseller", "vip reseller", "vip"].includes(role)) {
        setCanLaunch(true);
      }
    } catch {
      // not an admin / offline
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // continue clearing local state
    }

    try {
      localStorage.removeItem("user");
    } catch {}

    window.location.href = "/login";
  }

  return (
    <div className={`flex items-center gap-1.5 sm:gap-3 ${className}`}>
      {isAdmin && (
        <button
          onClick={() => router.push("/admin")}
          className="bg-zinc-900 border border-zinc-800 px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-zinc-800 transition-all"
        >
          ADMIN
        </button>
      )}

      {canLaunch && (brand.isOwner || brand.options.resellerLaunch) && (
        <button
          onClick={() => router.push("/launch")}
          className="hidden md:inline-flex items-center bg-gradient-to-r from-violet-600 to-fuchsia-600 px-2.5 sm:px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold text-white hover:brightness-110 transition-all whitespace-nowrap"
        >
          <span className="sm:hidden">Launch Website</span>
          <span className="hidden sm:inline">Launch Your Own Website</span>
        </button>
      )}

      <ChangePasswordButton />

      <button
        onClick={logout}
        className="bg-red-500/10 border border-red-500/20 text-red-400 p-2 sm:p-3 rounded-xl hover:bg-red-500/20 transition-all"
      >
        <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>
    </div>
  );
}

/** "Launch your own website" row for the phone menu (only when this store allows it). */
export function LaunchMenuButton({ onGo }: { onGo?: () => void }) {
  const router = useRouter();
  const brand = useBrand();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const j = await (await fetch("/api/auth/me", { cache: "no-store" })).json();
        const role = String(j?.user?.role ?? "").toLowerCase();
        setOk(!!j?.success && ["reseller", "vip_reseller", "vip reseller", "vip"].includes(role));
      } catch {}
    })();
  }, []);
  if (!ok || !(brand.isOwner || brand.options.resellerLaunch)) return null;
  return (
    <button onClick={() => { onGo?.(); router.push("/launch"); }} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600">
      Launch Your Own Website
    </button>
  );
}
