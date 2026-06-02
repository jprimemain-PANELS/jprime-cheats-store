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

  const [mobileNumber, 
  setMobileNumber] = 
   useState("");

  async function handleAuth() {

    if (isLogin) {

      const { data, error } =
  await supabase
    .from("users")
    .select("*")
    .eq("password", password)
    .or(
      `username.eq.${username},mobile_number.eq.${username}`
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

        if (
          !mobileNumber.trim() ||
          mobileNumber.length < 10
        ) {
        
          alert(
            "Enter valid mobile number"
          );
        
          return;
        }
      
        const { data: existingUser }
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
              mobile_number: mobileNumber,
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

        <div className="bg-zinc-900/80 backdrop-blur-2xl border border-cyan-500/20 rounded-3xl p-10 shadow-[0_0_50px_rgba(0,255,255,0.15)]">

          <div className="text-center mb-10">

          <div className="text-center mb-3">

  <h1 className="text-2xl md:text-5xl font-black tracking-[0.25em] text-cyan-400">

    JPRIME

  </h1>

  <p className="text-xs tracking-[0.5em] text-zinc-400 mt-2">

    CHEATS STORE

  </p>

</div>

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
            className="w-full bg-black/40 border border-cyan-500/20 rounded-2xl p-4 mb-4 outline-none focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(0,255,255,0.2)] transition-all"
          />

{!isLogin && (

<input
  type="text"
  placeholder="Mobile Number"
  value={mobileNumber}
  onChange={(e) =>
    setMobileNumber(e.target.value)
  }
  className="w-full bg-black/40 border border-cyan-500/20 rounded-2xl p-4 mb-4 outline-none focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(0,255,255,0.2)] transition-all"
/>

)}

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
            className="w-full bg-gradient-to-r from-cyan-400 to-blue-500 text-black py-4 rounded-2xl font-black text-lg hover:scale-[1.03] shadow-[0_0_25px_rgba(0,255,255,0.4)] transition-all duration-300"
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