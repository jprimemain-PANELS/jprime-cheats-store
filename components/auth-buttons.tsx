"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function AuthButtons() {
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  // The role comes from the server-verified session, not from the browser.
  async function checkAdmin() {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const json = await res.json();

      if (json?.success && json?.user?.role === "admin") {
        setIsAdmin(true);
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
    <div className="flex items-center gap-3">
      {isAdmin && (
        <button
          onClick={() => router.push("/admin")}
          className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all"
        >
          ADMIN
        </button>
      )}

      <button
        onClick={logout}
        className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl hover:bg-red-500/20 transition-all"
      >
        <LogOut className="h-5 w-5" />
      </button>
    </div>
  );
}
