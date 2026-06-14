"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, Monitor, Apple, User, ShoppingBag, ClipboardCheck, X } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { ProductCard } from "@/components/product-card";
import { ComingSoon } from "@/components/coming-soon";
import { FloatingSupport } from "@/components/floating-support";
import { Footer } from "@/components/footer";
import { supabase } from "@/lib/supabase";
import { mobileProducts, pcProducts } from "@/lib/products";

export default function Home() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState("mobile");
  const [showSuccess, setShowSuccess] = useState(false);
  const [deliveredKey, setDeliveredKey] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const productsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = localStorage.getItem("user");

    if (user) {
      setUserData(JSON.parse(user));
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    const copiedKey = localStorage.getItem("latest_key");

    if (copiedKey) {
      setDeliveredKey(copiedKey);
      setShowSuccess(true);
      navigator.clipboard.writeText(copiedKey);
      localStorage.removeItem("latest_key");
    }

    setCheckingAuth(false);
  }, [router]);

  const scrollToProducts = () => {
    productsRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  };

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    productsRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#030305]">
        {/* PREMIUM RING ANIMATION LOADING UNIT */}
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 border-4 border-zinc-800 rounded-full" />
          <div className="absolute inset-0 border-4 border-t-cyan-500 rounded-full animate-spin" />
        </div>
        <p className="text-zinc-400 text-xs font-bold tracking-[0.3em] uppercase animate-pulse">
          Verifying Session
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#030305] text-zinc-100 font-sans antialiased selection:bg-cyan-400 selection:text-black relative z-0">
      
      {/* FIXED LAYER ISOLATION BACKGROUND GLOW MATRIX */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-cyan-500/[0.04] rounded-full blur-[140px]" />
        <div className="absolute top-[40%] right-[-10%] w-[600px] h-[600px] bg-blue-600/[0.02] rounded-full blur-[140px]" />
      </div>

      {/* FIXED HIGHEST LAYER STRATIFICATION: SUCCESS COMPONENT */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#090a0e] border border-zinc-800/80 rounded-[2rem] p-8 max-w-md w-full relative overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.8)] z-10">
            
            {/* INLINE RAZOR EDGE SWORD REFLECTION EFFECT */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
              <div className="absolute top-[-150%] left-[-150%] w-[300%] h-[300%] bg-gradient-to-tr from-transparent via-white/[0.08] to-transparent transform rotate-45 animate-box-shimmer" />
            </div>

            <div className="text-center mb-6 relative z-10">
              <div className="w-12 h-12 bg-cyan-500/10 text-cyan-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-500/20">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-black tracking-wide text-white">
                Payment Completed
              </h2>
              <p className="text-zinc-400 text-xs font-medium mt-2">
                Your secure serial key has been saved to your clipboard automatically.
              </p>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-2xl break-all font-mono text-xs text-center text-cyan-400 tracking-wide mb-6 relative z-10 select-all shadow-inner">
              {deliveredKey}
            </div>

            <button
              onClick={() => setShowSuccess(false)}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black py-4 rounded-xl font-black text-xs tracking-widest transition-all duration-300 relative z-10 shadow-[0_4px_25px_rgba(6,182,212,0.25)]"
            >
              CONTINUE DASHBOARD
            </button>
          </div>
        </div>
      )}

      {/* CONTENT RUNTIME LAYER */}
      <div className="relative z-10 flex flex-col justify-between min-h-screen">
        <div>
          <Navbar
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
          />
          <Hero onScrollToProducts={scrollToProducts} />

          <div className="max-w-7xl mx-auto px-4 py-6"></div>

          {/* MAIN SYSTEM CATALOG SECTION */}
          <section
            ref={productsRef}
            className="scroll-mt-20 px-4 sm:px-6 lg:px-8 py-20"
          >
            <div className="mx-auto max-w-7xl">
              
              {/* CATEGORY SWITCH CONTROLLERS */}
              <div className="flex flex-wrap justify-center gap-4 mb-16">
                {[
                  { id: "mobile", label: "MOBILE PANEL", icon: Smartphone },
                  { id: "pc", label: "PC PANEL", icon: Monitor },
                  { id: "ios", label: "iOS PANEL", icon: Apple }
                ].map((cat) => {
                  const IconComponent = cat.icon;
                  const isSelected = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`flex items-center gap-3 px-7 py-3.5 rounded-2xl text-xs font-black tracking-widest transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                        isSelected
                          ? "bg-zinc-900 text-white border border-cyan-500/40 shadow-[0_0_30px_rgba(6,182,212,0.1)]"
                          : "bg-zinc-900/40 text-zinc-500 border border-zinc-800/50 hover:text-zinc-300 hover:bg-zinc-900/80"
                      }`}
                    >
                      <IconComponent className={`h-4 w-4 ${isSelected ? "text-cyan-400" : ""}`} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* DYNAMIC HEADER ANCHOR */}
              <div className="text-center mb-12">
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-wide uppercase">
                  {activeCategory === "mobile" && "Mobile Systems"}
                  {activeCategory === "pc" && "PC Engine Products"}
                  {activeCategory === "ios" && "iOS Architecture"}
                </h2>
                <p className="text-zinc-400 text-sm font-medium mt-3 max-w-2xl mx-auto">
                  {activeCategory === "mobile" && "Premium mobile internal tools supporting deployment workflows."}
                  {activeCategory === "pc" && "High performance desktop configurations built with precision frameworks."}
                  {activeCategory === "ios" && "Elegantly constructed ecosystems matching premium security criteria."}
                </p>
              </div>

              {/* PRODUCTS CONTAINER GRID MAPPINGS */}
              {activeCategory === "mobile" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in">
                  {mobileProducts.map((product, index) => (
                    <ProductCard key={product.id} product={product} index={index} />
                  ))}
                </div>
              )}

              {activeCategory === "pc" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in">
                  {pcProducts.map((product, index) => (
                    <ProductCard key={product.id} product={product} index={index} />
                  ))}
                </div>
              )}

              {activeCategory === "ios" && (
                <div className="max-w-2xl mx-auto animate-fade-in">
                  <ComingSoon />
                </div>
              )}
            </div>
          </section>
        </div>

        {/* BOTTOM RENDER ELEMENTS */}
        <div>
          <Footer />
          <FloatingSupport />
        </div>
      </div>

      {/* FLOAT ACTION CONSOLE PROFILE BUTTON */}
      <button
        onClick={async () => {
          setShowProfile(true);
          setLoadingHistory(true);
          const { data } = await supabase
            .from("purchase_history")
            .select("*")
            .eq("username", userData?.username)
            .order("created_at", { ascending: false });

          if (data) {
            setPurchaseHistory(data);
          }
          setLoadingHistory(false);
        }}
        className="fixed top-24 right-6 z-[40] p-4 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black transition-all duration-300 hover:scale-110 active:scale-95 shadow-[0_0_30px_rgba(6,182,212,0.4)] flex items-center justify-center group"
        title="View Profile"
      >
        <User className="h-5 w-5 stroke-[2.5]" />
      </button>

      {/* PROFILE DIALOG CENTER OVERLAY */}
      {showProfile && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#090a0e] border border-zinc-800/80 rounded-[2.25rem] p-8 w-full max-w-lg shadow-[0_40px_90px_rgba(0,0,0,0.9)] relative overflow-hidden max-h-[90vh] flex flex-col z-10">
            
            {/* INLINE RAZOR EDGE SWORD REFLECTION EFFECT */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
              <div className="absolute top-[-150%] left-[-150%] w-[300%] h-[300%] bg-gradient-to-tr from-transparent via-white/[0.08] to-transparent transform rotate-45 animate-box-shimmer" />
            </div>

            {/* DIALOG TITLE BAR */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-900 relative z-30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-cyan-400">
                  <User className="h-4 w-4" />
                </div>
                <h2 className="text-xl font-black text-white tracking-wide">
                  Account Management
                </h2>
              </div>
              <button 
                onClick={() => setShowProfile(false)}
                className="p-2 text-zinc-500 hover:text-zinc-300 rounded-xl hover:bg-zinc-900/50 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* USER STAT CARD CLUSTERS */}
            <div className="grid grid-cols-2 gap-4 mb-6 relative z-30">
              <div className="bg-zinc-950/60 border border-zinc-900 p-4 rounded-2xl">
                <p className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Client Handle</p>
                <p className="text-sm font-black text-white mt-1 truncate">{userData?.username}</p>
              </div>
              <div className="bg-zinc-950/60 border border-zinc-900 p-4 rounded-2xl">
                <p className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Account Tier</p>
                <p className="text-sm font-black text-cyan-400 mt-1 uppercase truncate">{userData?.role || "User"}</p>
              </div>
              <div className="bg-zinc-950/60 border border-zinc-900 p-4 rounded-2xl col-span-2">
                <p className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Registered Contact</p>
                <p className="text-sm font-medium text-zinc-300 mt-1 truncate">{userData?.email || "No email assigned"}</p>
              </div>
            </div>

            {/* TRANSACTIONS SECTION */}
            <div className="flex items-center gap-2 mb-4 relative z-30">
              <ShoppingBag className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-black tracking-widest text-zinc-400 uppercase">
                Purchase Registry ({purchaseHistory.length})
              </h3>
            </div>

            {/* TRANSACTION RECORD FLOW */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 relative z-30 custom-scrollbar mb-6">
              {loadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center text-zinc-600 gap-3">
                  <div className="w-6 h-6 border-2 border-zinc-800 border-t-cyan-500 rounded-full animate-spin" />
                  <p className="text-[11px] font-bold tracking-widest uppercase">Syncing Records</p>
                </div>
              ) : purchaseHistory.length === 0 ? (
                <div className="text-center py-12 text-zinc-600 text-xs font-medium border border-dashed border-zinc-900 rounded-2xl bg-zinc-950/20">
                  No registered active keys found on this identity.
                </div>
              ) : (
                purchaseHistory.map((item, index) => (
                  <div
                    key={index}
                    className="bg-zinc-950 border border-zinc-900/60 p-5 rounded-2xl hover:border-zinc-800 transition-colors duration-200"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h4 className="text-sm font-black text-white tracking-wide">
                          {item.product_name}
                        </h4>
                        <p className="text-[10px] text-zinc-500 font-bold tracking-wider mt-0.5 uppercase">
                          Term: {item.duration} &bull; {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-4 bg-zinc-900/40 p-2.5 rounded-xl border border-zinc-900">
                      <p className="font-mono text-xs text-cyan-400 break-all flex-1 select-all pl-1.5 tracking-wide">
                        {item.key_code}
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.key_code);
                          alert("Key copied safely to clipboard");
                        }}
                        className="bg-zinc-800 hover:bg-cyan-500 hover:text-black text-zinc-300 px-4 py-2 rounded-lg font-black text-[10px] tracking-widest transition-all duration-200 shrink-0 uppercase"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowProfile(false)}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 py-4 rounded-xl font-bold text-xs tracking-widest transition-all duration-200 border border-zinc-800 relative z-30"
            >
              DISMISS INTERFACE
            </button>
          </div>
        </div>
      )}

      {/* COMPACT ANIMATION STYLING INJECTORS */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes boxShimmer {
          0% { transform: translate(-30%, -30%) rotate(45deg); opacity: 0; }
          10%, 30% { opacity: 1; }
          45%, 100% { transform: translate(35%, 35%) rotate(45deg); opacity: 0; }
        }
        .animate-box-shimmer {
          animation: boxShimmer 7s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.99) translateY(4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1f1f23;
          border-radius: 99px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #2e2e33;
        }
      `}} />
    </main>
  );
}