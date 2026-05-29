"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .single();

    if (error || !data) {
      alert("Invalid Username or Password");
    } else {
      alert("Login Successful");
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
        <h1 className="text-3xl font-bold mb-6 text-center">
          Login
        </h1>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-3 rounded-xl bg-zinc-800 border border-zinc-700 mb-4"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 rounded-xl bg-zinc-800 border border-zinc-700 mb-6"
        />

        <button
          onClick={handleLogin}
          className="w-full bg-white text-black font-bold py-3 rounded-xl"
        >
          Login
        </button>
      </div>
    </div>
  );
}