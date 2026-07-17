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
        <div className="relative w-10 h-10 mb-4">
          <div className="absolute inset-0 border-2 border-zinc-800 rounded-full" />
          <div className="absolute inset-0 border-2 border-t-cyan-500 rounded-full animate-spin" />
        </div>
        <p className="text-zinc-500 text-xs font-medium">
          Verifying session…
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#030305] text-zinc-100 font-sans antialiased selection:bg-cyan-400 selection:text-black relative z-0">

      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[360px] bg-cyan-500/[0.05] rounded-full blur-[130px]" />
      </div>

      {/* Payment success modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#0a0b0f] border border-zinc-800 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-cyan-500/10 text-cyan-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-500/20">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-white">
                Payment complete
              </h2>
              <p className="text-zinc-400 text-sm mt-2">
                Your key has been copied to your clipboard.
              </p>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl break-all font-mono text-xs text-center text-cyan-400 mb-6 select-all">
              {deliveredKey}
            </div>

            <button
              onClick={() => setShowSuccess(false)}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black py-3.5 rounded-xl font-semibold text-sm transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Page content */}
      <div className="relative z-10 flex flex-col justify-between min-h-screen">
        <div>
          <Navbar
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
          />
          <Hero onScrollToProducts={scrollToProducts} />

          <div className="max-w-7xl mx-auto px-4 py-6"></div>

          {/* Product catalog */}
          <section
            ref={productsRef}
            className="scroll-mt-20 px-4 sm:px-6 lg:px-8 py-20"
          >
            <div className="mx-auto max-w-7xl">

              {/* Category switcher */}
              <div className="flex flex-wrap justify-center gap-3 mb-14">
                {[
                  { id: "mobile", label: "Mobile", icon: Smartphone },
                  { id: "pc", label: "PC", icon: Monitor },
                  { id: "ios", label: "iOS", icon: Apple }
                ].map((cat) => {
                  const IconComponent = cat.icon;
                  const isSelected = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-colors ${
                        isSelected
                          ? "bg-zinc-900 text-white border border-cyan-500/40"
                          : "bg-zinc-900/40 text-zinc-500 border border-zinc-800/60 hover:text-zinc-300 hover:bg-zinc-900/70"
                      }`}
                    >
                      <IconComponent className={`h-4 w-4 ${isSelected ? "text-cyan-400" : ""}`} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Section heading */}
              <div className="text-center mb-12">
                <h2 className="text-3xl sm:text-4xl font-semibold text-white">
                  {activeCategory === "mobile" && "Mobile"}
                  {activeCategory === "pc" && "PC"}
                  {activeCategory === "ios" && "iOS"}
                </h2>
                <p className="text-zinc-400 text-sm mt-3 max-w-2xl mx-auto">
                  {activeCategory === "mobile" && "Premium rooted and non-rooted mobile panels"}
                  {activeCategory === "pc" && "High-performance, safe desktop PC panels"}
                  {activeCategory === "ios" && "A dedicated iOS panel, built for safety"}
                </p>
              </div>

              {/* Product grid */}
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

        <div>
          <Footer />
          <FloatingSupport />
        </div>
      </div>

      {/* Profile trigger */}
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
        className="fixed top-24 right-6 z-[40] p-4 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black transition-transform hover:scale-105 active:scale-95 shadow-[0_0_25px_rgba(6,182,212,0.35)] flex items-center justify-center"
        title="View Profile"
      >
        <User className="h-5 w-5" />
      </button>

      {/* Profile dialog */}
      {showProfile && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0a0b0f] border border-zinc-800 rounded-2xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

            <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-900">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-cyan-400">
                  <User className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-semibold text-white">
                  Profile
                </h2>
              </div>
              <button
                onClick={() => setShowProfile(false)}
                className="p-2 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-900/50 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-zinc-950/60 border border-zinc-900 p-4 rounded-xl">
                <p className="text-xs text-zinc-500">Username</p>
                <p className="text-sm font-semibold text-white mt-1 truncate">{userData?.username}</p>
              </div>
              <div className="bg-zinc-950/60 border border-zinc-900 p-4 rounded-xl">
                <p className="text-xs text-zinc-500">Account type</p>
                <p className="text-sm font-semibold text-cyan-400 mt-1 truncate">{userData?.role || "User"}</p>
              </div>
              <div className="bg-zinc-950/60 border border-zinc-900 p-4 rounded-xl col-span-2">
                <p className="text-xs text-zinc-500">Email</p>
                <p className="text-sm font-medium text-zinc-300 mt-1 truncate">{userData?.email || "No email on file"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-medium text-zinc-300">
                Purchase history ({purchaseHistory.length})
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar mb-6">
              {loadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center text-zinc-600 gap-3">
                  <div className="w-5 h-5 border-2 border-zinc-800 border-t-cyan-500 rounded-full animate-spin" />
                  <p className="text-xs">Loading history…</p>
                </div>
              ) : purchaseHistory.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-sm border border-dashed border-zinc-900 rounded-xl bg-zinc-950/20">
                  No purchases yet.
                </div>
              ) : (
                purchaseHistory.map((item, index) => (
                  <div
                    key={index}
                    className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl hover:border-zinc-800 transition-colors"
                  >
                    <h4 className="text-sm font-semibold text-white">
                      {item.product_name}
                    </h4>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {item.duration} &bull; {new Date(item.created_at).toLocaleDateString()}
                    </p>

                    <div className="flex items-center gap-2.5 mt-3 bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-900">
                      <p className="font-mono text-xs text-cyan-400 break-all flex-1 select-all">
                        {item.key_code}
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.key_code);
                          alert("Key copied to clipboard");
                        }}
                        className="bg-zinc-800 hover:bg-cyan-500 hover:text-black text-zinc-300 px-3.5 py-1.5 rounded-md font-medium text-xs transition-colors shrink-0"
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
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 py-3.5 rounded-xl font-medium text-sm transition-colors border border-zinc-800"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
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