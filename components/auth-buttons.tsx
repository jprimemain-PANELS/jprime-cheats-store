"use client";

import {
  useEffect,
  useState,
} from "react";

import { useRouter }
from "next/navigation";

import { supabase }
from "@/lib/supabase";

import { LogOut } from "lucide-react";

export function AuthButtons() {

  const router =
    useRouter();

  const [isAdmin,
  setIsAdmin] =
    useState(false);

  useEffect(() => {

    checkAdmin();

  }, []);

  async function checkAdmin() {

    const user =
      JSON.parse(
        localStorage.getItem(
          "user"
        ) || "{}"
      );

    if (!user?.email)
      return;

    const {
      data,
    } = await supabase
      .from("users")
      .select("*")
      .eq(
        "email",
        user.email
      )
      .single();

    if (
      data?.role ===
      "admin"
    ) {

      setIsAdmin(true);
    }
  }

  async function logout() {

    localStorage.removeItem(
      "user"
    );

    window.location.href =
      "/login";
  }

  return (

    <div className="flex items-center gap-3">

      {isAdmin && (

        <button
          onClick={() =>
            router.push("/admin")
          }
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