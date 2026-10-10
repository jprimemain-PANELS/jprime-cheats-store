"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Play,
  ShoppingCart,
  Bell,
  Wallet,
  QrCode,
  Loader2,
  ChevronRight,
  CheckCircle2,
  Copy,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { useVipPrices } from "@/lib/useVipPrices";
import type { Product, PriceTier } from "@/lib/products";

interface ProductCardProps {
  product: Product;
  index: number;
}

const WALLET_BALANCE_EVENT = "wallet-balance-updated";

// Special row in product_prices that stores the product status.
// price_inr = 0 -> ONLINE, price_inr = 1 -> MAINTENANCE.
const STATUS_ROW = "__status__";

export function ProductCard({ product, index }: ProductCardProps) {
  const [selectedDuration, setSelectedDuration] = useState<string>(
    product.prices[0]?.duration ?? ""
  );

  const [liveOverrides, setLiveOverrides] = useState<
    Record<string, { priceINR: number; resellerPrice?: number }>
  >({});

  // Live status from the database (null = nothing saved, fall back to products.ts)
  const [liveStatus, setLiveStatus] = useState<"ONLINE" | "MAINTENANCE" | null>(null);
  const effectiveStatus: "ONLINE" | "MAINTENANCE" = liveStatus ?? product.status;

  const [isHovered, setIsHovered] = useState(false);
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [userRole, setUserRole] = useState("user");
  const [walletBalance, setWalletBalance] = useState<number>(0);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [purchasedKey, setPurchasedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [showAutoCopyToast, setShowAutoCopyToast] = useState(false);

  // Per-reseller (VIP) custom prices. Empty for everyone except resellers
  // who have custom prices saved by the admin.
  const vipPrices = useVipPrices(userRole === "reseller");

  /*
   * Merge live prices from Supabase with products.ts prices.
   * Reseller price priority:
   *   1. This reseller's own VIP price (reseller_price_overrides)
   *   2. The common reseller price (product_prices / catalog)
   */
  const effectivePrices = useMemo<PriceTier[]>(() => {
    return product.prices.map((tier) => {
      const override = liveOverrides[tier.duration];

      let result: PriceTier = tier;

      if (override) {
        result = {
          ...tier,
          priceINR: `₹${Math.round(override.priceINR)}`,
          resellerPrice:
            override.resellerPrice != null
              ? `₹${Math.round(override.resellerPrice)}`
              : tier.resellerPrice,
        };
      }

      const vip = vipPrices[`${product.name}::${tier.duration}`];

      if (userRole === "reseller" && vip != null && Number.isFinite(vip)) {
        result = {
          ...result,
          resellerPrice: `₹${Math.round(vip)}`,
        };
      }

      return result;
    });
  }, [product.name, product.prices, liveOverrides, vipPrices]);

  const selectedPrice: PriceTier =
    effectivePrices.find(
      (price) => price.duration === selectedDuration
    ) ?? effectivePrices[0];

  /*
   * Load stock and user information.
   */
  useEffect(() => {
    loadStock();
    loadUserData();
  }, [selectedDuration]);

  /*
   * Load live prices and live status (both come from product_prices).
   */
  useEffect(() => {
    let cancelled = false;

    async function loadLivePrices() {
      let data: any[] = [];

      try {
        const res = await fetch(
          `/api/product-prices?product=${encodeURIComponent(product.name)}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();
        data = Array.isArray(json?.rows) ? json.rows : [];
      } catch (error: any) {
        console.error(
          `Live price lookup failed for "${product.name}":`,
          error?.message || error
        );
        return;
      }

      if (cancelled) return;

      const map: Record<
        string,
        { priceINR: number; resellerPrice?: number }
      > = {};

      let statusFromDb: "ONLINE" | "MAINTENANCE" | null = null;

      for (const row of (data || []) as any[]) {
        if (row.duration === STATUS_ROW) {
          statusFromDb = Number(row.price_inr) === 1 ? "MAINTENANCE" : "ONLINE";
          continue;
        }

        map[row.duration] = {
          priceINR: Number(row.price_inr),
          resellerPrice:
            row.reseller_price != null
              ? Number(row.reseller_price)
              : undefined,
        };
      }

      setLiveOverrides(map);
      setLiveStatus(statusFromDb);
    }

    loadLivePrices();

    return () => {
      cancelled = true;
    };
  }, [product.name]);

  /*
   * Auto-hide copied toast.
   */
  useEffect(() => {
    if (!showAutoCopyToast) return;

    const timer = setTimeout(() => {
      setShowAutoCopyToast(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [showAutoCopyToast]);

  /*
   * Listen for wallet balance changes from other components.
   */
  useEffect(() => {
    function handleExternalBalanceUpdate(e: Event) {
      const detail = (e as CustomEvent<{ balance: number }>).detail;

      if (detail && typeof detail.balance === "number") {
        setWalletBalance(detail.balance);
      }
    }

    window.addEventListener(
      WALLET_BALANCE_EVENT,
      handleExternalBalanceUpdate
    );

    return () => {
      window.removeEventListener(
        WALLET_BALANCE_EVENT,
        handleExternalBalanceUpdate
      );
    };
  }, []);

  /*
   * Load product stock.
   */
  async function loadStock() {
    // API products are delivered via supplier API, so skip local database stock check
    if (product.fulfillmentType === "API") {
      setAvailableStock(999);
      return;
    }

    try {
      const res = await fetch(
        `/api/stock-count?product=${encodeURIComponent(
          product.name
        )}&duration=${encodeURIComponent(selectedDuration)}`,
        { cache: "no-store" }
      );

      const json = await res.json();

      if (!res.ok || typeof json?.count !== "number") {
        setAvailableStock(null);
        return;
      }

      setAvailableStock(json.count);
    } catch (error) {
      console.error("Stock loading error:", error);
      setAvailableStock(null);
    }
  }

  /*
   * Load user role and wallet balance.
   */
  async function loadUserData(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    try {
      const response = await fetch("/api/get-wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (response.status === 401) {
        // Session missing or expired: forget the stale display hint.
        try {
          localStorage.removeItem("user");
        } catch {}

        setUserRole("user");
        setWalletBalance(0);
        return false;
      }

      const result = await response.json();

      if (result.success) {
        setUserRole(result.role || "user");
        setWalletBalance(Number(result.balance));
        return true;
      }
    } catch (error) {
      console.error("Error reading user data:", error);
    }

    return false;
  }

  /*
   * Get numeric price.
   */
  const getNumericPrice = (): number => {
    if (!selectedPrice) {
      return 0;
    }

    const rawPrice =
      userRole === "reseller"
        ? selectedPrice.resellerPrice || selectedPrice.priceINR
        : selectedPrice.priceINR;

    return parseFloat(
      String(rawPrice).replace(/[^\d.]/g, "")
    ) || 0;
  };

  const formattedPrice = selectedPrice
    ? userRole === "reseller"
      ? selectedPrice.resellerPrice || selectedPrice.priceINR
      : selectedPrice.priceINR
    : "₹0";

  /*
   * Buy button.
   */
  const handleInitialBuyClick = async () => {
    if (effectiveStatus === "MAINTENANCE") {
      alert("This product is under maintenance. Please check back soon.");
      return;
    }

    if (product.fulfillmentType !== "API" && availableStock === 0) {
      alert("This product is currently out of stock.");
      return;
    }

    const loggedIn = await loadUserData();

    if (!loggedIn) {
      alert("Please login before purchasing.");
      window.location.href = "/login";
      return;
    }

    setIsPaymentModalOpen(true);
  };

  /*
   * Wallet payment.
   */
  const handleWalletPayment = async () => {
    try {
      setIsProcessing(true);

      const numericPrice = getNumericPrice();

      if (walletBalance < numericPrice) {
        alert(
          `Insufficient wallet balance (₹${walletBalance.toFixed(
            2
          )}). Please add funds or use UPI.`
        );

        setIsProcessing(false);
        return;
      }

      const response = await fetch("/api/pay-via-wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // The server decides who the buyer is and what the price is.
        body: JSON.stringify({
          product_name: product.name,

          duration: selectedPrice.duration,
        }),
      });

      const result = await response.json();

      if (response.status === 401) {
        alert("Your session has expired. Please login again.");
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !result.success) {
        if (typeof result.newBalance === "number") {
          setWalletBalance(result.newBalance);
        }

        alert(result.error || "Wallet payment failed.");
        setIsProcessing(false);
        return;
      }

      /*
       * Update wallet balance locally.
       */
      if (result.newBalance !== undefined) {
        setWalletBalance(result.newBalance);

        /*
         * Broadcast wallet update.
         */
        window.dispatchEvent(
          new CustomEvent(WALLET_BALANCE_EVENT, {
            detail: {
              balance: result.newBalance,
            },
          })
        );
      }

      /*
       * Close payment modal.
       */
      setIsPaymentModalOpen(false);

      /*
       * Show purchased key.
       */
      setPurchasedKey(result.key);
      setShowKeyModal(true);

      /*
       * Auto copy key.
       */
      if (result.key) {
        try {
          await navigator.clipboard.writeText(result.key);
          setShowAutoCopyToast(true);
        } catch (error) {
          console.error("Clipboard error:", error);
        }
      }

      /*
       * Refresh stock after purchase.
       */
      await loadStock();
    } catch (error) {
      console.error("Wallet Payment Error:", error);
      alert("Something went wrong with the wallet payment.");
    } finally {
      setIsProcessing(false);
    }
  };

  /*
   * UPI payment.
   */
  const handleUpiPayment = async () => {
    try {
      setIsProcessing(true);

      const response = await fetch("/api/create-upi-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // The server decides who the buyer is and what the price is.
        body: JSON.stringify({
          product_name: product.name,

          duration: selectedPrice.duration,
        }),
      });

      const result = await response.json();

      if (response.status === 401) {
        alert("Your session has expired. Please login again.");
        setIsProcessing(false);
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !result.success) {
        alert(
          result.error || "Failed to create payment order."
        );

        setIsProcessing(false);
        return;
      }

      if (!result.payment?.order_id) {
        alert(
          "Payment order was created incorrectly. Please try again."
        );

        setIsProcessing(false);
        return;
      }

      const orderId = encodeURIComponent(
        result.payment.order_id
      );

      window.location.href =
        `/upi-payment?order_id=${orderId}`;
    } catch (error) {
      console.error("UPI Payment Error:", error);

      alert(
        "Unable to start payment. Please try again."
      );

      setIsProcessing(false);
    }
  };

  /*
   * Copy key again.
   */
  async function handleCopyKeyAgain() {
    if (!purchasedKey) return;

    try {
      await navigator.clipboard.writeText(purchasedKey);

      setKeyCopied(true);

      setTimeout(() => {
        setKeyCopied(false);
      }, 1800);
    } catch (error) {
      console.error("Clipboard error:", error);
    }
  }

  return (
    <>
      {/* PRODUCT CARD */}
      <Card
        className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[#0c081a]/70 backdrop-blur-xl transition-all duration-500 hover:border-fuchsia-500/40 hover:shadow-[0_15px_40px_rgba(192,38,211,0.2)]"
        style={{
          animationDelay: `${index * 100}ms`,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Top ambient highlight glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />

        {/* VIDEO CONTAINER */}
        <div className="relative aspect-video overflow-hidden bg-black/40">
          {/* Status Badge */}
          <div className="pointer-events-none absolute left-3 top-3 z-20">
            <span
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-md ${
                effectiveStatus === "ONLINE"
                  ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                  : "border-amber-500/40 bg-amber-500/20 text-amber-300"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  effectiveStatus === "ONLINE"
                    ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"
                    : "bg-amber-400"
                }`}
              />
              {effectiveStatus === "ONLINE" ? "Online" : "Maintenance"}
            </span>
          </div>

          {product.videoUrl ? (
            <video
              controls
              className="h-full w-full object-cover"
            >
              <source
                src={product.videoUrl}
                type="video/mp4"
              />
            </video>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-violet-950/30 to-black/60">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/15 backdrop-blur-md transition-all duration-300 ${
                  isHovered
                    ? "scale-110 bg-fuchsia-500/30 border-fuchsia-500/60 shadow-[0_0_20px_rgba(192,38,211,0.5)]"
                    : ""
                }`}
              >
                <Play className="ml-1 h-6 w-6 text-fuchsia-300" />
              </div>

              <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
                Demo Video
              </span>
            </div>
          )}
        </div>

        {/* CARD CONTENT */}
        <div className="space-y-5 p-6">
          <div>
            <h3 className="text-xl font-extrabold leading-tight tracking-tight text-white group-hover:text-fuchsia-300 transition-colors">
              {product.name}
            </h3>

            <Badge
              variant="secondary"
              className="mt-2.5 border border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300 text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full"
            >
              {product.category.toUpperCase()}
            </Badge>
          </div>

          {/* FEATURES LIST */}
          <div className="space-y-2">
            {product.features.map((feature, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 text-xs text-white/70"
              >
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-fuchsia-400/40 bg-fuchsia-500/20">
                  <Check className="h-2.5 w-2.5 text-fuchsia-300 stroke-[3]" />
                </div>

                <span className="font-medium text-white/80">
                  {feature}
                </span>
              </div>
            ))}
          </div>

          {/* DURATION SELECTION */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              Select Plan Duration
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {effectivePrices.map((price, i) => {
                const isSelected = selectedPrice?.duration === price.duration;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedDuration(price.duration)}
                    className={`flex flex-col items-start rounded-2xl border p-3.5 transition-all duration-300 cursor-pointer ${
                      isSelected
                        ? "border-fuchsia-500 bg-fuchsia-500/20 shadow-[0_0_15px_rgba(192,38,211,0.3)]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="text-xs font-semibold text-white/60">
                      {price.duration}
                    </span>

                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-base font-extrabold text-white">
                        {userRole === "reseller"
                          ? price.resellerPrice || price.priceINR
                          : price.priceINR}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex gap-2.5 pt-2">
            <Button
              disabled={
                effectiveStatus === "MAINTENANCE" ||
                (product.fulfillmentType !== "API" && availableStock === 0)
              }
              className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-xs tracking-wider uppercase py-5 rounded-xl shadow-[0_4px_20px_rgba(192,38,211,0.4)] transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleInitialBuyClick}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              {effectiveStatus === "MAINTENANCE"
                ? "MAINTENANCE"
                : product.fulfillmentType !== "API" && availableStock === 0
                ? "OUT OF STOCK"
                : "BUY NOW"}
            </Button>

            <Button
              variant="outline"
              className="flex-1 border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 text-white font-semibold text-xs tracking-wider uppercase py-5 rounded-xl transition-all duration-300"
              onClick={() =>
                window.open(
                  product.updateChannel,
                  "_blank"
                )
              }
            >
              <Bell className="mr-2 h-4 w-4 text-fuchsia-400" />
              PANEL FILE
            </Button>
          </div>
        </div>
      </Card>

      {/* PAYMENT METHOD MODAL */}
      <Dialog
        open={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
      >
        <DialogContent className="overflow-hidden rounded-3xl border border-white/15 bg-[#090514]/95 p-0 shadow-[0_30px_100px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:max-w-[440px] text-white">
          <div className="relative p-6 md:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div className="paymodal-glow-a absolute -right-16 -top-20 h-56 w-56 rounded-full bg-fuchsia-600/20 blur-[80px]" />
              <div className="paymodal-glow-b absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-violet-600/20 blur-[80px]" />
            </div>

            <div className="paymodal-panel-in relative z-10">
              <DialogHeader className="space-y-2 text-left">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/20 text-fuchsia-300">
                    <ShoppingCart className="h-5 w-5" />
                  </span>

                  <DialogTitle className="text-xl font-extrabold tracking-tight text-white">
                    Checkout Payment
                  </DialogTitle>
                </div>

                <DialogDescription className="pl-[52px] text-xs font-medium text-white/60">
                  {product.name} —{" "}
                  <span className="font-bold text-fuchsia-300">
                    {selectedPrice?.duration}
                  </span>{" "}
                  <span className="font-mono text-white/80">
                    ({formattedPrice})
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="my-6 grid gap-3.5">
                {/* WALLET OPTION */}
                <button
                  disabled={isProcessing}
                  onClick={handleWalletPayment}
                  className="group/opt relative flex items-center justify-between overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition-all duration-300 hover:border-fuchsia-500/50 hover:bg-fuchsia-500/10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="relative z-10 flex items-center gap-3.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/20 text-fuchsia-300 transition-all group-hover/opt:bg-fuchsia-500 group-hover/opt:text-white">
                      <Wallet className="h-5 w-5" />
                    </span>

                    <span>
                      <span className="block text-sm font-bold text-white">
                        Pay via Wallet Balance
                      </span>

                      <span className="mt-0.5 block font-mono text-xs text-fuchsia-300/80">
                        Available: ₹{walletBalance.toFixed(2)}
                      </span>
                    </span>
                  </span>

                  <span className="relative z-10 flex items-center gap-2">
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                      INSTANT
                    </span>

                    <ChevronRight className="h-4 w-4 text-white/40 opacity-0 transition-all group-hover/opt:translate-x-1 group-hover/opt:opacity-100" />
                  </span>
                </button>

                {/* UPI OPTION */}
                <button
                  disabled={isProcessing}
                  onClick={handleUpiPayment}
                  className="group/opt relative flex items-center justify-between overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition-all duration-300 hover:border-fuchsia-500/50 hover:bg-fuchsia-500/10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="relative z-10 flex items-center gap-3.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300 transition-all group-hover/opt:bg-violet-500 group-hover/opt:text-white">
                      <QrCode className="h-5 w-5" />
                    </span>

                    <span>
                      <span className="block text-sm font-bold text-white">
                        Instant UPI Payment
                      </span>

                      <span className="mt-0.5 block text-xs text-white/50">
                        Scan QR Code & Enter UTR
                      </span>
                    </span>
                  </span>

                  <ChevronRight className="relative z-10 h-4 w-4 text-white/40 opacity-0 transition-all group-hover/opt:translate-x-1 group-hover/opt:opacity-100" />
                </button>
              </div>

              {isProcessing && (
                <div className="flex items-center gap-3 rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-3.5">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-fuchsia-400" />

                  <div className="flex-1">
                    <p className="text-xs font-semibold text-white">
                      Processing purchase transaction…
                    </p>

                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <div className="paymodal-progress h-full w-1/3 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <style jsx>{`
            .paymodal-glow-a {
              animation: paymodalDrift 6s ease-in-out infinite;
            }
            .paymodal-glow-b {
              animation: paymodalDrift 8s ease-in-out infinite reverse;
            }
            @keyframes paymodalDrift {
              0%, 100% {
                transform: translate(0, 0) scale(1);
                opacity: 0.6;
              }
              50% {
                transform: translate(-10px, 10px) scale(1.15);
                opacity: 1;
              }
            }
            .paymodal-panel-in {
              animation: paymodalPanelIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
            }
            @keyframes paymodalPanelIn {
              0% {
                opacity: 0;
                transform: translateY(10px) scale(0.99);
              }
              100% {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
            .paymodal-progress {
              animation: paymodalProgress 1.4s ease-in-out infinite;
            }
            @keyframes paymodalProgress {
              0% {
                transform: translateX(-100%);
              }
              50% {
                transform: translateX(60%);
              }
              100% {
                transform: translateX(220%);
              }
            }
          `}</style>
        </DialogContent>
      </Dialog>

      {/* SUCCESS / KEY DELIVERY MODAL */}
      <Dialog
        open={showKeyModal}
        onOpenChange={setShowKeyModal}
      >
        <DialogContent className="overflow-hidden rounded-3xl border border-emerald-500/40 bg-[#070b12]/95 p-0 shadow-[0_30px_100px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:max-w-[420px] text-white">
          <div className="relative p-6 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div className="keycard-glow-a absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-500/20 blur-[80px]" />
              <div className="keycard-glow-b absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-fuchsia-500/10 blur-[80px]" />
            </div>

            <div className="keycard-panel-in relative z-10 flex flex-col items-center">
              <span className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/20 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
                <span className="keycard-ring pointer-events-none absolute inset-0 rounded-full border border-emerald-400/50" />
                <CheckCircle2 className="keycard-check-pop h-8 w-8 text-emerald-400" />
              </span>

              <DialogHeader className="items-center space-y-1">
                <DialogTitle className="text-xl font-extrabold text-white">
                  Purchase Successful!
                </DialogTitle>

                <DialogDescription className="text-xs font-medium text-white/60">
                  {product.name} —{" "}
                  <span className="font-bold text-fuchsia-300">
                    {selectedPrice?.duration}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="mt-5 w-full text-left">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  Your Serial / License Key
                </p>

                <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                  <div
                    aria-hidden
                    className="keycard-shimmer pointer-events-none absolute inset-0"
                  />
                  <p className="relative z-10 break-all font-mono text-sm font-semibold text-emerald-300">
                    {purchasedKey}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyKeyAgain}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/20 py-3 text-xs font-bold text-emerald-300 transition-all hover:bg-emerald-500/30 active:scale-95 cursor-pointer shadow-[0_4px_20px_rgba(16,185,129,0.2)]"
              >
                {keyCopied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied to Clipboard
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy License Key
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="mt-2 w-full rounded-xl py-2 text-xs font-semibold text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>

          <style jsx>{`
            .keycard-panel-in {
              animation: keycardPanelIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
            }
            @keyframes keycardPanelIn {
              0% {
                opacity: 0;
                transform: translateY(14px) scale(0.97);
              }
              100% {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
            .keycard-check-pop {
              animation: keycardCheckPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
            }
            @keyframes keycardCheckPop {
              0% {
                opacity: 0;
                transform: scale(0.4);
              }
              60% {
                opacity: 1;
                transform: scale(1.1);
              }
              100% {
                opacity: 1;
                transform: scale(1);
              }
            }
            .keycard-ring {
              animation: keycardRingPulse 2s cubic-bezier(0, 0, 0.2, 1) infinite;
            }
            @keyframes keycardRingPulse {
              0% {
                transform: scale(1);
                opacity: 0.6;
              }
              70%, 100% {
                transform: scale(1.6);
                opacity: 0;
              }
            }
            .keycard-glow-a {
              animation: keycardDrift 6s ease-in-out infinite;
            }
            .keycard-glow-b {
              animation: keycardDrift 8s ease-in-out infinite reverse;
            }
            @keyframes keycardDrift {
              0%, 100% {
                transform: translate(0, 0) scale(1);
                opacity: 0.6;
              }
              50% {
                transform: translate(-10px, 10px) scale(1.15);
                opacity: 1;
              }
            }
            .keycard-shimmer {
              background: linear-gradient(
                100deg,
                transparent 30%,
                rgba(16, 185, 129, 0.2) 50%,
                transparent 70%
              );
              background-size: 200% 100%;
              animation: keycardShimmerSweep 2.6s ease-in-out infinite;
            }
            @keyframes keycardShimmerSweep {
              0% {
                background-position: 200% 0;
              }
              100% {
                background-position: -50% 0;
              }
            }
          `}</style>
        </DialogContent>
      </Dialog>

      {/* AUTO COPY TOAST */}
      {showAutoCopyToast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed right-5 top-5 z-[999] flex justify-end"
        >
          <div className="toast-in pointer-events-auto flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-[#070b12]/95 px-5 py-3.5 text-xs font-bold text-white shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>Key automatically copied to clipboard!</span>
          </div>

          <style jsx>{`
            .toast-in {
              animation:
                toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both,
                toastSlideOut 0.3s ease-in 2.7s forwards;
            }
            @keyframes toastSlideIn {
              0% {
                opacity: 0;
                transform: translateX(24px) scale(0.96);
              }
              100% {
                opacity: 1;
                transform: translateX(0) scale(1);
              }
            }
            @keyframes toastSlideOut {
              0% {
                opacity: 1;
                transform: translateX(0) scale(1);
              }
              100% {
                opacity: 0;
                transform: translateX(24px) scale(0.96);
              }
            }
          `}</style>
        </div>
      )}
    </>
  );
}