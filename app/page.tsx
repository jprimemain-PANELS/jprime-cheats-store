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
      
  const [activeCategory,
  setActiveCategory] =
    useState("mobile");

  const [showSuccess,
  setShowSuccess] =
    useState(false);

  const [deliveredKey,
  setDeliveredKey] =
    useState("");

  const productsRef =
    useRef<HTMLDivElement>(
      null
    );

    useEffect(() => {

      const user =
        localStorage.getItem(
          "user"
        );
    
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

      <Footer />

      <FloatingSupport />

    </main>
  );
}