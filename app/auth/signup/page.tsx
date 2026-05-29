"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async () => {
    if (!username || !password) {
      alert("Enter username and password");
      return;
    }

    const { error } = await supabase.from("users").insert([
      {
        username,
        password,
      },
    ]);

    if (error) {
      alert(error.message);
    } else {
      alert("Account Created Successfully");
      window.location.href = "/auth/login";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
        <h1 className="text-3xl font-bold mb-6 text-center">
          Create Account
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
          onClick={handleSignup}
          className="w-full bg-white text-black font-bold py-3 rounded-xl"
        >
          Create Account
        </button>
      </div>
    </div>
  );
}