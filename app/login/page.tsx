"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { User, Lock, Phone, Mail, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  async function handleAuth() {
    if (isLogin) {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("password", password)
        .or(`username.eq.${username},mobile_number.eq.${username}`)
        .single();

      if (error || !data) {
        alert("Invalid username or password");
        return;
      }

      localStorage.setItem("user", JSON.stringify(data));
      window.location.href = "/";
    } else {
      if (!mobileNumber.trim() || mobileNumber.length < 10) {
        alert("Enter valid mobile number");
        return;
      }

      const { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .eq("username", username)
        .single();

      if (existingUser) {
        alert("Username already exists");
        return;
      }

      const { error } = await supabase.from("users").insert([
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
        alert("Signup Success");
        setIsLogin(true);
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#020204] text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden font-sans antialiased selection:bg-cyan-400 selection:text-black">
      
      {/* ================= CINEMATIC BACKGROUND SYSTEM ================= */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Deep Global Aurora Shift */}
        <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-gradient-to-b from-cyan-500/[0.08] via-blue-600/[0.03] to-transparent rounded-full blur-[160px] animate-cosmic-pulse" />
        
        {/* Luxury Linear Light Pillars */}
        <div className="absolute top-0 left-[15%] w-[1px] h-full bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent blur-[1px] animate-pillar-drift" />
        <div className="absolute top-0 right-[20%] w-[1px] h-full bg-gradient-to-b from-transparent via-blue-500/5 to-transparent blur-[1px] animate-pillar-drift-delayed" />

        {/* Micro Shimmer Starfield */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute w-[2px] h-[2px] bg-white rounded-full top-[25%] left-[30%] animate-shimmer" style={{ animationDelay: '0s' }} />
          <div className="absolute w-[2px] h-[2px] bg-cyan-300 rounded-full top-[65%] left-[75%] animate-shimmer" style={{ animationDelay: '2s' }} />
          <div className="absolute w-[3px] h-[3px] bg-white rounded-full top-[15%] left-[80%] animate-shimmer" style={{ animationDelay: '4s' }} />
          <div className="absolute w-[2px] h-[2px] bg-blue-400 rounded-full top-[85%] left-[20%] animate-shimmer" style={{ animationDelay: '1s' }} />
        </div>
      </div>

      {/* ================= INTERFACE CONTENT SYSTEM ================= */}
      <div className="relative z-10 w-full max-w-md">
        
        {/* LUXURY CHASSIS PANEL WITH ADVANCED SWORD REFLECTION */}
        <div className="bg-[#07080b]/90 backdrop-blur-3xl border border-zinc-800/50 rounded-[2.25rem] p-8 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.9)] relative overflow-hidden group/card transition-all duration-500 hover:border-zinc-700/60">
          
          {/* MULTI-STAGE SWORD GLINT LAYER (Razor edge + deep sun metallic flare) */}
          <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
            {/* 1. Primary Razor Sharp Steel Edge */}
            <div className="absolute top-[-150%] left-[-150%] w-[300%] h-[300%] bg-gradient-to-tr from-transparent via-white/[0.18] to-transparent transform rotate-[35deg] animate-sword-edge" />
            
            {/* 2. Secondary Deep Sun Soft Prism Reflection Flare */}
            <div className="absolute top-[-150%] left-[-150%] w-[300%] h-[300%] bg-gradient-to-tr from-transparent via-cyan-400/[0.06] to-transparent transform rotate-[35deg] animate-sword-flare" />
            
            {/* 3. Corner Flash Interceptor */}
            <div className="absolute inset-0 border border-cyan-400/0 group-hover/card:border-cyan-400/10 rounded-[2.25rem] transition-all duration-700 animate-border-flash" />
          </div>

          {/* BRAND TEXT HEADMARK */}
          <div className="text-center mb-10 relative z-20">
            <h1 className="text-5xl font-black tracking-[0.25em] text-white drop-shadow-[0_4px_20px_rgba(255,255,255,0.02)]">
              JPRIME
            </h1>
            <p className="text-[11px] font-bold tracking-[0.45em] text-cyan-400 mt-3 uppercase">
              CHEATS STORE
            </p>
            
            <p className="text-zinc-400 text-sm font-medium mt-8">
              {isLogin ? "Sign in to continue" : "Create your credentials"}
            </p>
          </div>

          {/* INPUT CHANNELS */}
          <div className="space-y-4 relative z-20">
            
            {/* INPUT FIELD: USERNAME */}
            <div className="relative group/input">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-500 group-focus-within/input:text-cyan-400 transition-colors duration-200">
                <User className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold tracking-wide text-white placeholder-zinc-600 outline-none focus:border-cyan-500/50 focus:bg-zinc-950 focus:shadow-[0_0_35px_rgba(6,182,212,0.06)] transition-all duration-300"
              />
            </div>

            {/* INPUT FIELD: MOBILE NUMBER */}
            {!isLogin && (
              <div className="relative animate-form-reveal">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-500">
                  <Phone className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Mobile Number"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold tracking-wide text-cyan-400 placeholder-zinc-600 outline-none focus:border-cyan-500/50 focus:bg-zinc-950 focus:shadow-[0_0_35px_rgba(6,182,212,0.06)] transition-all duration-300"
                />
              </div>
            )}

            {/* INPUT FIELD: EMAIL ADDRESS */}
            {!isLogin && (
              <div className="relative animate-form-reveal">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-500">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold tracking-wide text-white placeholder-zinc-600 outline-none focus:border-cyan-500/50 focus:bg-zinc-950 focus:shadow-[0_0_35px_rgba(6,182,212,0.06)] transition-all duration-300"
                />
              </div>
            )}

            {/* INPUT FIELD: PASSWORD */}
            <div className="relative group/input">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-500 group-focus-within/input:text-cyan-400 transition-colors duration-200">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold tracking-wide text-white placeholder-zinc-600 outline-none focus:border-cyan-500/50 focus:bg-zinc-950 focus:shadow-[0_0_35px_rgba(6,182,212,0.06)] transition-all duration-300"
              />
            </div>

          </div>

          {/* PRIMARY INTERACTIVE TRIGGER BUTTON */}
          <div className="mt-8 relative z-20">
            <button
              onClick={handleAuth}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black py-4.5 rounded-2xl font-black text-sm tracking-[0.25em] transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] shadow-[0_4px_35px_rgba(6,182,212,0.25)] hover:shadow-[0_4px_50px_rgba(6,182,212,0.55)] flex items-center justify-center gap-2"
            >
              <span>{isLogin ? "LOG IN" : "SIGN UP"}</span>
              <ArrowRight className="h-4 w-4 stroke-[3]" />
            </button>
          </div>

          {/* ALTERNATE CONNECTOR LINK */}
          <div className="mt-8 text-center relative z-20 border-t border-zinc-900 pt-6">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-zinc-600 hover:text-zinc-300 font-bold text-xs tracking-wider uppercase transition-colors duration-200"
            >
              {isLogin ? "Create an account" : "Return to login handle"}
            </button>
          </div>

        </div>

      </div>

      {/* CORE HIGH-END VISUAL LAYER ANIMATIONS */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* --- NEXT-LEVEL MULTI-STAGE SWORD REFLECTION --- */
        @keyframes swordEdge {
          0% { transform: translate(-35%, -35%) rotate(35deg); opacity: 0; }
          5% { opacity: 1; }
          22% { transform: translate(35%, 35%) rotate(35deg); opacity: 0; }
          100% { transform: translate(35%, 35%) rotate(35deg); opacity: 0; }
        }
        @keyframes swordFlare {
          0% { transform: translate(-35%, -35%) rotate(35deg); opacity: 0; }
          4% { opacity: 0; }
          8% { opacity: 1; }
          26% { transform: translate(35%, 35%) rotate(35deg); opacity: 0; }
          100% { transform: translate(35%, 35%) rotate(35deg); opacity: 0; }
        }
        @keyframes borderFlash {
          0%, 100% { border-color: rgba(6, 182, 212, 0); shadow: none; }
          12% { border-color: rgba(6, 182, 212, 0.35); }
          22% { border-color: rgba(6, 182, 212, 0); }
        }
        .animate-sword-edge {
          animation: swordEdge 6s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
        }
        .animate-sword-flare {
          animation: swordFlare 6s cubic-bezier(0.25, 1, 0.3, 1) infinite;
        }
        .animate-border-flash {
          animation: borderFlash 6s ease-in-out infinite;
        }

        /* --- AMBIENT BACKGROUND ANIMATION CHANNELS --- */
        @keyframes cosmicPulse {
          0%, 100% { opacity: 0.6; transform: translate(-50%, 0) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -3%) scale(1.05); }
        }
        .animate-cosmic-pulse {
          animation: cosmicPulse 10s ease-in-out infinite;
        }
        @keyframes pillarDrift {
          0%, 100% { transform: translateX(0px); opacity: 0.4; }
          50% { transform: translateX(30px); opacity: 0.8; }
        }
        @keyframes pillarDriftDelayed {
          0%, 100% { transform: translateX(0px); opacity: 0.3; }
          50% { transform: translateX(-40px); opacity: 0.6; }
        }
        .animate-pillar-drift {
          animation: pillarDrift 14s ease-in-out infinite;
        }
        .animate-pillar-drift-delayed {
          animation: pillarDriftDelayed 18s ease-in-out infinite;
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .animate-shimmer {
          animation: shimmer 4s ease-in-out infinite;
        }
        @keyframes formReveal {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-form-reveal {
          animation: formReveal 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />
    </div>
  );
}