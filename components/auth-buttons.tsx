"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { ChangePasswordButton } from "@/components/change-password";

export function AuthButtons() {
  const router = useRouter();

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
    <div className="flex items-center gap-2 sm:gap-3">
      {isAdmin && (
        <button
          onClick={() => router.push("/admin")}
          className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all"
        >
          ADMIN
        </button>
      )}

      {canLaunch && (
        <button
          onClick={() => router.push("/launch")}
          className="inline-flex items-center bg-gradient-to-r from-violet-600 to-fuchsia-600 px-2.5 sm:px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold text-white hover:brightness-110 transition-all whitespace-nowrap"
        >
          <span className="sm:hidden">Launch Website</span>
          <span className="hidden sm:inline">Launch Your Own Website</span>
        </button>
      )}

      <ChangePasswordButton />

      <button
        onClick={logout}
        className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl hover:bg-red-500/20 transition-all"
      >
        <LogOut className="h-5 w-5" />
      </button>
    </div>
  );
}
