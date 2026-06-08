"use client";

import {
  useState,
  useRef,
  useEffect,
} from "react";

import { useRouter }
from "next/navigation";

import {
  Smartphone,
  Monitor,
  Apple,
} from "lucide-react";

import { Navbar }
from "@/components/navbar";

import { Hero }
from "@/components/hero";

import { ProductCard }
from "@/components/product-card";

import { ComingSoon }
from "@/components/coming-soon";

import { FloatingSupport }
from "@/components/floating-support";

import { Footer }
from "@/components/footer";

import { supabase }
from "@/lib/supabase";

import {
  mobileProducts,
  pcProducts,
} from "@/lib/products";

export default function Home() {

  const router =
    useRouter();

  const [checkingAuth,
  setCheckingAuth] =
    useState(true);

  const [userData,
  setUserData] =
    useState<any>(null);
      
  const [activeCategory,
  setActiveCategory] =
    useState("mobile");

  const [showSuccess,
  setShowSuccess] =
    useState(false);

  const [deliveredKey,
  setDeliveredKey] =
    useState("");

  const [showProfile,
  setShowProfile] =
    useState(false);
  
  const [purchaseHistory,
  setPurchaseHistory] =
    useState<any[]>([]);
      
  const [loadingHistory,
  setLoadingHistory] =
    useState(false);

  const productsRef =
    useRef<HTMLDivElement>(
      null
    );

    useEffect(() => {

      const user =
        localStorage.getItem(
          "user"
        );

        if (user) {

          setUserData(
            JSON.parse(user)
          );
        }
    
      if (!user) {
    
        router.replace(
          "/login"
        );
    
        return;
      }
    
      const copiedKey =
        localStorage.getItem(
          "latest_key"
        );
    
      if (copiedKey) {
    
        setDeliveredKey(
          copiedKey
        );
    
        setShowSuccess(true);
    
        navigator.clipboard.writeText(
          copiedKey
        );
    
        localStorage.removeItem(
          "latest_key"
        );
      }
    
      setCheckingAuth(false);
    
    }, [router]);

  const scrollToProducts =
    () => {

    productsRef.current
      ?.scrollIntoView({
        behavior:
          "smooth",
      });
  };

  const handleCategoryChange =
    (category: string) => {

    setActiveCategory(
      category
    );

    productsRef.current
      ?.scrollIntoView({
        behavior:
          "smooth",
      });
  };
  if (checkingAuth) {

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">

      <div className="text-white text-xl font-bold">

        Loading...

      </div>

    </div>
  );
}

  return (
    <main className="min-h-screen bg-background">

      {showSuccess && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-md w-full mx-4">

            <h2 className="text-3xl font-bold mb-4 text-center">

              Payment Success 😎🔥

            </h2>

            <p className="text-zinc-400 text-center mb-6">

              Your key has been copied automatically

            </p>

            <div className="bg-black p-4 rounded-2xl break-all text-sm font-mono mb-6">

              {deliveredKey}

            </div>

            <button
              onClick={() =>
                setShowSuccess(
                  false
                )
              }
              className="w-full bg-white text-black py-3 rounded-2xl font-bold"
            >

              OK

            </button>

          </div>

        </div>
      )}

      <Navbar
        activeCategory={
          activeCategory
        }
        onCategoryChange={
          handleCategoryChange
        }
      />

      <Hero
        onScrollToProducts={
          scrollToProducts
        }
      />

<div className="max-w-7xl mx-auto px-4 py-6">


</div>

      <section
        ref={productsRef}
        className="scroll-mt-20 px-4 sm:px-6 lg:px-8 py-16"
      >

        <div className="mx-auto max-w-7xl">

          <div className="flex flex-wrap justify-center gap-3 mb-12">

            <button
              onClick={() =>
                setActiveCategory(
                  "mobile"
                )
              }
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeCategory ===
                "mobile"
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-secondary/30 text-muted-foreground border border-border/30 hover:bg-secondary/50 hover:text-foreground"
              }`}
            >

              <Smartphone className="h-4 w-4" />

              MOBILE PANEL

            </button>

            <button
              onClick={() =>
                setActiveCategory(
                  "pc"
                )
              }
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeCategory ===
                "pc"
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-secondary/30 text-muted-foreground border border-border/30 hover:bg-secondary/50 hover:text-foreground"
              }`}
            >

              <Monitor className="h-4 w-4" />

              PC PANEL

            </button>

            <button
              onClick={() =>
                setActiveCategory(
                  "ios"
                )
              }
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeCategory ===
                "ios"
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-secondary/30 text-muted-foreground border border-border/30 hover:bg-secondary/50 hover:text-foreground"
              }`}
            >

              <Apple className="h-4 w-4" />

              iOS PANEL

            </button>

          </div>

          <div className="text-center mb-10">

            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">

              {activeCategory ===
                "mobile" &&
                "Mobile Panel Products"}

              {activeCategory ===
                "pc" &&
                "PC Panel Products"}

              {activeCategory ===
                "ios" &&
                "iOS Panel"}

            </h2>

            <p className="text-muted-foreground max-w-2xl mx-auto">

              {activeCategory ===
                "mobile" &&
                "Premium mobile gaming solutions with root and non-root support"}

              {activeCategory ===
                "pc" &&
                "Professional PC gaming tools with advanced features"}

              {activeCategory ===
                "ios" &&
                "Coming soon - Premium iOS solutions"}

            </p>

          </div>

          {activeCategory ===
            "mobile" && (

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {mobileProducts.map(
                (
                  product,
                  index
                ) => (

                <ProductCard
                  key={product.id}
                  product={product}
                  index={index}
                />
              ))}

            </div>
          )}

          {activeCategory ===
            "pc" && (

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {pcProducts.map(
                (
                  product,
                  index
                ) => (

                <ProductCard
                  key={product.id}
                  product={product}
                  index={index}
                />
              ))}

            </div>
          )}

          {activeCategory ===
            "ios" && (

            <div className="max-w-2xl mx-auto">

              <ComingSoon />

            </div>
          )}

        </div>

      </section>

      {/* Floating Profile Button */}

<button
  onClick={async () => {

    setShowProfile(true);
  
    setLoadingHistory(true);
  
    const { data } =
      await supabase
        .from(
          "purchase_history"
        )
        .select("*")
        .eq(
          "username",
          userData?.username
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        );
  
    if (data) {
  
      setPurchaseHistory(
        data
      );
    }
  
    setLoadingHistory(false);
  
  }}
  className="fixed bottom-24 right-6 z-50 px-5 py-3 rounded-full bg-cyan-500 text-black font-bold shadow-[0_0_25px_rgba(0,255,255,0.8)] animate-pulse hover:scale-110 transition-all"
>

  👤 Profile

</button>

{showProfile && (

  <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">

<div className="bg-zinc-900/95 backdrop-blur-xl border border-cyan-500/50 rounded-3xl p-6 w-full max-w-md shadow-[0_0_50px_rgba(0,255,255,0.25)]">

      <h2 className="text-2xl font-bold mb-4">

        👤 My Profile

      </h2>

      <p>
        Username: {userData?.username}
      </p>

      <p>
        Email: {userData?.email}
      </p>

      <p>
  Role: {userData?.role}
</p>

<hr className="my-4 border-zinc-700" />

<p className="text-cyan-400 font-bold">

  📦 Total Purchases:
  {" "}
  {purchaseHistory.length}

</p>

<h3 className="text-lg font-bold mb-3">

📦 Purchase History

</h3>

{loadingHistory ? (

<p>
Loading...
</p>

) : (

<div className="space-y-3 max-h-64 overflow-y-auto">

  {purchaseHistory.map(
    (item, index) => (

    <div
      key={index}
      className="bg-black/50 p-3 rounded-xl"
    >

      <p>

        {item.product_name}

      </p>

      <p>

        {item.duration}

      </p>

      <p className="text-zinc-400 text-sm">

  Purchased:
  {" "}
  {new Date(
    item.created_at
  ).toLocaleDateString()}

</p>

<p className="text-cyan-400 break-all text-sm mb-2">

{item.key_code}

</p>

<button
onClick={() => {

  navigator.clipboard.writeText(
    item.key_code
  );

  alert(
    "Key Copied 😎🔥"
  );

}}
className="bg-cyan-500 text-black px-3 py-2 rounded-xl font-bold text-sm hover:scale-105 transition-all"
>

📋 Copy Key

</button>

    </div>
  ))}

</div>
)}
      

      <button
        onClick={() =>
          setShowProfile(false)
        }
        className="mt-6 w-full bg-cyan-500 text-black py-3 rounded-2xl font-bold"
      >

        Close

      </button>

    </div>

  </div>
)}

      <Footer />

      <FloatingSupport />

    </main>
  );
}