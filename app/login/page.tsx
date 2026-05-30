"use client";

import { useState }
from "react";

import { supabase }
from "@/lib/supabase";

export default function LoginPage() {

  const [isLogin,
  setIsLogin] =
    useState(true);

  const [username,
  setUsername] =
    useState("");

  const [password,
  setPassword] =
    useState("");

  const [email,
  setEmail] =
    useState("");

  async function handleAuth() {

    if (isLogin) {

      const { data, error } =
        await supabase
          .from("users")
          .select("*")
          .eq(
            "username",
            username
          )
          .eq(
            "password",
            password
          )
          .single();

      if (error || !data) {

        alert(
          "Invalid username or password"
        );

        return;
      }

      localStorage.setItem(
        "user",
        JSON.stringify(data)
      );

      window.location.href =
        "/";

    } else {

      const { data:
        existingUser }
        = await supabase
          .from("users")
          .select("*")
          .eq(
            "username",
            username
          )
          .single();

      if (existingUser) {

        alert(
          "Username already exists"
        );

        return;
      }

      const { error } =
        await supabase
          .from("users")
          .insert([
            {
              username,
              password,
              email,
              role: "user",
            },
          ]);

      if (error) {

        alert(error.message);

      } else {

        alert(
          "Signup Success"
        );

        setIsLogin(true);
      }
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center overflow-hidden relative">

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,200,255,0.15),transparent_40%)]" />

      <div className="relative z-10 w-full max-w-md px-6">

        <div className="bg-zinc-900/70 backdrop-blur-2xl border border-zinc-800 rounded-3xl p-10 shadow-[0_0_60px_rgba(0,200,255,0.08)]">

          <div className="text-center mb-10">

          <h1 className="text-2x1 md:text-3xl font-black tracking-tight mb-3 whitespace-nowrap">

              JPRIME CHEATS STORE

            </h1>

            <p className="text-zinc-400">

              {isLogin
                ? "Login to continue"
                : "Create your account"}

            </p>

          </div>

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) =>
              setUsername(
                e.target.value
              )
            }
            className="w-full bg-zinc-800/80 border border-zinc-700 rounded-2xl p-4 mb-4 outline-none focus:border-cyan-400 transition-all"
          />

          {!isLogin && (

            <input
              type="email"
              placeholder="Email (optional)"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              className="w-full bg-zinc-800/80 border border-zinc-700 rounded-2xl p-4 mb-4 outline-none focus:border-cyan-400 transition-all"
            />
          )}

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(
                e.target.value
              )
            }
            className="w-full bg-zinc-800/80 border border-zinc-700 rounded-2xl p-4 mb-6 outline-none focus:border-cyan-400 transition-all"
          />

          <button
            onClick={handleAuth}
            className="w-full bg-cyan-400 text-black py-4 rounded-2xl font-black text-lg hover:scale-[1.02] transition-all duration-300"
          >

            {isLogin
              ? "LOGIN"
              : "SIGNUP"}

          </button>

          <button
            onClick={() =>
              setIsLogin(
                !isLogin
              )
            }
            className="w-full mt-5 text-zinc-400 hover:text-white transition-all"
          >

            {isLogin
              ? "Create new account"
              : "Already have account? Login"}

          </button>

        </div>

      </div>

    </div>
  );
}