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

import { supabase } from "@/lib/supabase";
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

  /*
   * Merge live prices from Supabase with products.ts prices.
   */
  const effectivePrices = useMemo<PriceTier[]>(() => {
    return product.prices.map((tier) => {
      const override = liveOverrides[tier.duration];

      if (!override) {
        return tier;
      }

      return {
        ...tier,
        priceINR: `₹${Math.round(override.priceINR)}`,
        resellerPrice:
          override.resellerPrice != null
            ? `₹${Math.round(override.resellerPrice)}`
            : tier.resellerPrice,
      };
    });
  }, [product.prices, liveOverrides]);

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
      const { data, error } = await supabase
        .from("product_prices")
        .select("duration, price_inr, reseller_price")
        .eq("product_name", product.name);

      if (error) {
        console.error(
          `Live price lookup failed for "${product.name}":`,
          error.message
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
    if (product.fulfillmentType === "API") {
      setAvailableStock(999);
      return;
    }

    const { data, error } = await supabase
      .from("stock_keys")
      .select("*")
      .eq("product_name", product.name)
      .eq("duration", selectedDuration)
      .eq("is_used", false);

    if (error) {
      console.error("Stock loading error:", error.message);
      setAvailableStock(null);
      return;
    }

    setAvailableStock(data?.length ?? 0);
  }

  /*
   * Load user role and wallet balance.
   */
  async function loadUserData() {
    if (typeof window === "undefined") return;

    const savedUser = localStorage.getItem("user");

    if (!savedUser) {
      return;
    }

    try {
      const user = JSON.parse(savedUser);

      setUserRole(user.role || "user");

      if (
        user.wallet_balance !== undefined &&
        user.wallet_balance !== null
      ) {
        setWalletBalance(Number(user.wallet_balance));
      } else if (user.balance !== undefined && user.balance !== null) {
        setWalletBalance(Number(user.balance));
      }

      const identifier = user.username || user.email;

      if (!identifier) {
        return;
      }

      const response = await fetch("/api/get-wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: user.username || user.email,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setWalletBalance(Number(result.balance));
      }
    } catch (error) {
      console.error("Error reading user data:", error);
    }
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

    const savedUserRaw = localStorage.getItem("user");

    let currentUser: any = {};

    try {
      currentUser = JSON.parse(savedUserRaw || "{}");
    } catch {
      currentUser = {};
    }

    if (!currentUser?.username && !currentUser?.email) {
      alert("Please login before purchasing.");
      window.location.href = "/login";
      return;
    }

    await loadUserData();

    setIsPaymentModalOpen(true);
  };

  /*
   * Wallet payment.
   */
  const handleWalletPayment = async () => {
    try {
      setIsProcessing(true);

      const savedUserRaw = localStorage.getItem("user");

      let currentUser: any = {};

      try {
        currentUser = JSON.parse(savedUserRaw || "{}");
      } catch {
        currentUser = {};
      }

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
        body: JSON.stringify({
          username:
            currentUser.username || currentUser.email,

          product_name: product.name,

          duration: selectedPrice.duration,

          amount: numericPrice,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "Wallet payment failed.");
        setIsProcessing(false);
        return;
      }

      if (result.newBalance !== undefined) {
        currentUser.wallet_balance = result.newBalance;

        localStorage.setItem(
          "user",
          JSON.stringify(currentUser)
        );

        setWalletBalance(result.newBalance);

        window.dispatchEvent(
          new CustomEvent(WALLET_BALANCE_EVENT, {
            detail: {
              balance: result.newBalance,
            },
          })
        );
      }

      setIsPaymentModalOpen(false);
      setPurchasedKey(result.key);
      setShowKeyModal(true);

      if (result.key) {
        try {
          await navigator.clipboard.writeText(result.key);
          setShowAutoCopyToast(true);
        } catch (error) {
          console.error("Clipboard error:", error);
        }
      }

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

      const savedUserRaw = localStorage.getItem("user");

      let currentUser: any = {};

      try {
        currentUser = JSON.parse(savedUserRaw || "{}");
      } catch {
        currentUser = {};
      }

      const finalPrice = getNumericPrice();

      const response = await fetch("/api/create-upi-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username:
            currentUser.username || currentUser.email,

          product_name: product.name,

          duration: selectedPrice.duration,

          amount: String(finalPrice),
        }),
      });

      const result = await response.json();

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
        className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#07040f]/80 text-white backdrop-blur-md transition-all duration-500 hover:border-fuchsia-500/40 hover:shadow-[0_10px_40px_-10px_rgba(192,38,211,0.3)]"
        style={{
          animationDelay: `${index * 100}ms`,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Glow Effects */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-fuchsia-600/10 blur-[50px] transition-all group-hover:bg-fuchsia-600/25" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-violet-600/10 blur-[50px] transition-all group-hover:bg-violet-600/25" />

        {/* VIDEO CONTAINER */}
        <div className="relative aspect-video overflow-hidden bg-black/40">
          <div className="pointer-events-none absolute left-3 top-3 z-20">
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md ${
                effectiveStatus === "ONLINE"
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/15 text-amber-400"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  effectiveStatus === "ONLINE"
                    ? "bg-emerald-400 animate-pulse"
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
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-violet-950/20 to-fuchsia-950/20">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-violet-600/30 to-fuchsia-600/30 text-fuchsia-300 backdrop-blur-md transition-all duration-300 ${
                  isHovered
                    ? "scale-110 border-fuchsia-500/50 shadow-[0_0_20px_rgba(192,38,211,0.5)]"
                    : ""
                }`}
              >
                <Play className="ml-1 h-6 w-6 fill-current text-white" />
              </div>

              <span className="text-xs font-medium text-white/50">
                Demo Video
              </span>
            </div>
          )}
        </div>

        {/* CONTENT */}
        <div className="space-y-5 p-5">
          <div>
            <h3 className="text-lg font-bold leading-tight tracking-tight text-white">
              {product.name}
            </h3>

            <Badge
              variant="secondary"
              className="mt-2 border border-white/10 bg-white/5 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300 backdrop-blur-md"
            >
              {product.category.toUpperCase()}
            </Badge>
          </div>

          {/* FEATURES */}
          <div className="space-y-2">
            {product.features.map((feature, i) => (
              <div
                key={i}
                className="flex items-center gap-2"
              >
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-500/30 to-fuchsia-500/30 text-fuchsia-400">
                  <Check className="h-2.5 w-2.5" />
                </div>

                <span className="text-xs leading-relaxed text-white/70">
                  {feature}
                </span>
              </div>
            ))}
          </div>

          {/* DURATIONS */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
              Select Duration
            </p>

            <div className="grid grid-cols-2 gap-2">
              {effectivePrices.map((price, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() =>
                    setSelectedDuration(price.duration)
                  }
                  className={`flex flex-col items-start rounded-xl border p-2.5 transition-all duration-200 cursor-pointer ${
                    selectedPrice?.duration === price.duration
                      ? "border-fuchsia-500/60 bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 text-white shadow-[0_0_15px_rgba(192,38,211,0.25)]"
                      : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="text-[11px] font-medium text-white/60">
                    {price.duration}
                  </span>

                  <div className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="text-sm font-bold text-white">
                      {userRole === "reseller"
                        ? price.resellerPrice || price.priceINR
                        : price.priceINR}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* BUTTONS */}
          <div className="flex gap-2 pt-2">
            <Button
              disabled={
                effectiveStatus === "MAINTENANCE" ||
                (product.fulfillmentType !== "API" && availableStock === 0)
              }
              className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-xs font-bold text-white shadow-[0_4px_25px_-4px_rgba(192,38,211,0.6)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_6px_30px_-2px_rgba(192,38,211,0.8)] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
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
              className="flex-1 rounded-xl border-white/10 bg-white/[0.04] text-xs font-semibold text-white/80 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              onClick={() =>
                window.open(
                  product.updateChannel,
                  "_blank"
                )
              }
            >
              <Bell className="mr-2 h-4 w-4 text-fuchsia-400" />
              PANEL LINK
            </Button>
          </div>
        </div>
      </Card>

      {/* PAYMENT MODAL */}
      <Dialog
        open={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
      >
        <DialogContent className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0614]/95 p-0 text-white shadow-[0_30px_90px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:max-w-[440px]">
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div className="paymodal-glow-a absolute -right-16 -top-20 h-56 w-56 rounded-full bg-fuchsia-600/20 blur-[70px]" />
              <div className="paymodal-glow-b absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-violet-600/20 blur-[70px]" />
            </div>

            <div className="paymodal-panel-in relative z-10 p-6">
              <DialogHeader className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 text-fuchsia-300">
                    <ShoppingCart className="h-4 w-4" />
                  </span>

                  <DialogTitle className="text-lg font-bold tracking-tight text-white">
                    Choose Payment Method
                  </DialogTitle>
                </div>

                <DialogDescription className="pl-[46px] text-xs text-white/60">
                  {product.name} —{" "}
                  <span className="font-semibold text-fuchsia-300">
                    {selectedPrice?.duration}
                  </span>{" "}
                  <span className="font-mono text-white/80">
                    ({formattedPrice})
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="my-5 grid gap-3">
                {/* WALLET PAYMENT BUTTON */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleWalletPayment}
                  className="group/opt relative flex items-center justify-between overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-fuchsia-500/50 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  <span className="relative z-10 flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-fuchsia-300 transition-all group-hover/opt:scale-105">
                      <Wallet className="h-5 w-5" />
                    </span>

                    <span>
                      <span className="block text-sm font-semibold text-white">
                        Pay Using Wallet
                      </span>

                      <span className="mt-0.5 block font-mono text-xs text-white/50">
                        Balance: ₹{walletBalance.toFixed(2)}
                      </span>
                    </span>
                  </span>

                  <span className="relative z-10 flex items-center gap-2">
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      Instant
                    </span>

                    <ChevronRight className="h-4 w-4 text-white/40 transition-all group-hover/opt:translate-x-0.5 group-hover/opt:text-white" />
                  </span>
                </button>

                {/* UPI PAYMENT BUTTON */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleUpiPayment}
                  className="group/opt relative flex items-center justify-between overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-fuchsia-500/50 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  <span className="relative z-10 flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-fuchsia-300 transition-all group-hover/opt:scale-105">
                      <QrCode className="h-5 w-5" />
                    </span>

                    <span>
                      <span className="block text-sm font-semibold text-white">
                        Instant UPI Payment
                      </span>

                      <span className="mt-0.5 block text-xs text-white/50">
                        Scan QR Code &amp; Enter UTR
                      </span>
                    </span>
                  </span>

                  <ChevronRight className="relative z-10 h-4 w-4 text-white/40 transition-all group-hover/opt:translate-x-0.5 group-hover/opt:text-white" />
                </button>
              </div>

              {isProcessing && (
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-fuchsia-400" />

                  <div className="flex-1">
                    <p className="text-xs font-medium text-white/80">
                      Processing your request…
                    </p>

                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
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
              0%,
              100% {
                transform: translate(0, 0) scale(1);
                opacity: 0.6;
              }

              50% {
                transform: translate(-10px, 10px) scale(1.15);
                opacity: 1;
              }
            }

            .paymodal-panel-in {
              animation: paymodalPanelIn 0.45s
                cubic-bezier(0.16, 1, 0.3, 1) both;
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
              animation: paymodalProgress 1.4s
                ease-in-out infinite;
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

            @media (prefers-reduced-motion: reduce) {
              .paymodal-glow-a,
              .paymodal-glow-b,
              .paymodal-panel-in,
              .paymodal-progress {
                animation: none !important;
              }
            }
          `}</style>
        </DialogContent>
      </Dialog>

      {/* SUCCESS / KEY MODAL */}
      <Dialog
        open={showKeyModal}
        onOpenChange={setShowKeyModal}
      >
        <DialogContent className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-[#0a0614]/95 p-0 text-white shadow-[0_30px_90px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:max-w-[420px]">
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div className="keycard-glow-a absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-500/15 blur-[70px]" />
              <div className="keycard-glow-b absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-fuchsia-500/15 blur-[70px]" />
            </div>

            <div className="keycard-panel-in relative z-10 flex flex-col items-center p-6 text-center">
              <span className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15">
                <span className="keycard-ring pointer-events-none absolute inset-0 rounded-full border border-emerald-400/40" />
                <CheckCircle2 className="keycard-check-pop h-7 w-7 text-emerald-400" />
              </span>

              <DialogHeader className="items-center space-y-1.5">
                <DialogTitle className="text-lg font-bold text-white">
                  Purchase Successful!
                </DialogTitle>

                <DialogDescription className="text-xs text-white/60">
                  {product.name} —{" "}
                  <span className="font-semibold text-fuchsia-300">
                    {selectedPrice?.duration}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="mt-5 w-full text-left">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
                  Your Login Key
                </p>

                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-4">
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
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-fuchsia-500/30 bg-gradient-to-r from-violet-600/30 to-fuchsia-600/30 py-2.5 text-xs font-bold text-white transition-all hover:bg-gradient-to-r hover:from-violet-600 hover:to-fuchsia-600 active:scale-[0.98] cursor-pointer"
              >
                {keyCopied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" />
                    Copied to Clipboard
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Key
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="mt-2 w-full rounded-xl py-2 text-xs font-medium text-white/50 transition-colors hover:text-white cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>

          <style jsx>{`
            .keycard-panel-in {
              animation: keycardPanelIn 0.5s
                cubic-bezier(0.16, 1, 0.3, 1) both;
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
              animation: keycardCheckPop 0.5s
                cubic-bezier(0.34, 1.56, 0.64, 1) both;
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
              animation: keycardRingPulse 2s
                cubic-bezier(0, 0, 0.2, 1) infinite;
            }

            @keyframes keycardRingPulse {
              0% {
                transform: scale(1);
                opacity: 0.6;
              }

              70%,
              100% {
                transform: scale(1.6);
                opacity: 0;
              }
            }

            .keycard-glow-a {
              animation: keycardDrift 6s
                ease-in-out infinite;
            }

            .keycard-glow-b {
              animation: keycardDrift 8s
                ease-in-out infinite reverse;
            }

            @keyframes keycardDrift {
              0%,
              100% {
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
                rgba(192, 38, 211, 0.15) 50%,
                transparent 70%
              );

              background-size: 200% 100%;

              animation: keycardShimmerSweep
                2.6s ease-in-out infinite;
            }

            @keyframes keycardShimmerSweep {
              0% {
                background-position: 200% 0;
              }

              100% {
                background-position: -50% 0;
              }
            }

            @media (prefers-reduced-motion: reduce) {
              .keycard-panel-in,
              .keycard-check-pop,
              .keycard-ring,
              .keycard-glow-a,
              .keycard-glow-b,
              .keycard-shimmer {
                animation: none !important;
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
          className="pointer-events-none fixed right-4 top-4 z-[999] flex justify-end"
        >
          <div className="toast-in pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-[#0a0614]/95 px-4 py-3 text-xs font-medium text-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />

            <span>
              Your key has been automatically copied to clipboard.
            </span>
          </div>

          <style jsx>{`
            .toast-in {
              animation:
                toastSlideIn 0.35s
                  cubic-bezier(0.16, 1, 0.3, 1) both,
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

            @media (prefers-reduced-motion: reduce) {
              .toast-in {
                animation: none !important;
              }
            }
          `}</style>
        </div>
      )}
    </>
  );
}