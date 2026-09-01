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

export function ProductCard({ product, index }: ProductCardProps) {
  const [selectedDuration, setSelectedDuration] = useState<string>(
    product.prices[0]?.duration ?? ""
  );

  const [liveOverrides, setLiveOverrides] = useState<
    Record<string, { priceINR: number; resellerPrice?: number }>
  >({});

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
   * Load live prices.
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

      (data || []).forEach((row: any) => {
        map[row.duration] = {
          priceINR: Number(row.price_inr),
          resellerPrice:
            row.reseller_price != null
              ? Number(row.reseller_price)
              : undefined,
        };
      });

      setLiveOverrides(map);
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

      /*
       * Immediately use cached balance.
       */
      if (
        user.wallet_balance !== undefined &&
        user.wallet_balance !== null
      ) {
        setWalletBalance(Number(user.wallet_balance));
      } else if (user.balance !== undefined && user.balance !== null) {
        setWalletBalance(Number(user.balance));
      }

      /*
       * Fetch fresh wallet balance.
       */
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

      /*
       * Update wallet balance locally.
       */
      if (result.newBalance !== undefined) {
        currentUser.wallet_balance = result.newBalance;

        localStorage.setItem(
          "user",
          JSON.stringify(currentUser)
        );

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
        className="group relative overflow-hidden border border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-500 hover:border-primary/30 hover:shadow-[0_0_40px_rgba(0,200,255,0.08)]"
        style={{
          animationDelay: `${index * 100}ms`,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* VIDEO */}

        <div className="relative aspect-video overflow-hidden bg-secondary/50">
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
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/20 transition-all duration-300 ${
                  isHovered
                    ? "scale-110 bg-primary/30"
                    : ""
                }`}
              >
                <Play className="ml-1 h-6 w-6 text-primary" />
              </div>

              <span className="text-xs text-muted-foreground">
                Demo Video
              </span>
            </div>
          )}
        </div>

        {/* CONTENT */}

        <div className="space-y-5 p-5">
          <div>
            <h3 className="text-lg font-semibold leading-tight tracking-tight text-foreground">
              {product.name}
            </h3>

            <Badge
              variant="secondary"
              className="mt-2 border-0 bg-secondary/80 text-xs text-muted-foreground"
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
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-2.5 w-2.5 text-primary" />
                </div>

                <span className="text-sm text-muted-foreground">
                  {feature}
                </span>
              </div>
            ))}
          </div>

          {/* DURATIONS */}

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Select Duration
            </p>

            <div className="grid grid-cols-2 gap-2">
              {effectivePrices.map((price, i) => (
                <button
                  key={i}
                  onClick={() =>
                    setSelectedDuration(price.duration)
                  }
                  className={`flex flex-col items-start rounded-lg border p-3 transition-all duration-200 ${
                    selectedPrice?.duration ===
                    price.duration
                      ? "border-primary/50 bg-primary/10"
                      : "border-border/50 bg-secondary/30 hover:border-border hover:bg-secondary/50"
                  }`}
                >
                  <span className="text-xs text-muted-foreground">
                    {price.duration}
                  </span>

                  <div className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="text-sm font-semibold text-foreground">
                      {userRole === "reseller"
                        ? price.resellerPrice ||
                          price.priceINR
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
              disabled={product.fulfillmentType !== "API" && availableStock === 0}
              className="flex-1 bg-primary text-primary-foreground transition-all duration-300 hover:bg-primary/90 disabled:opacity-50"
              onClick={handleInitialBuyClick}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />

              {product.fulfillmentType !== "API" && availableStock === 0
                ? "OUT OF STOCK"
                : "BUY"}
            </Button>

            <Button
              variant="outline"
              className="flex-1 border-border/50 text-foreground transition-all duration-300 hover:border-border hover:bg-secondary"
              onClick={() =>
                window.open(
                  product.updateChannel,
                  "_blank"
                )
              }
            >
              <Bell className="mr-2 h-4 w-4" />

              PANEL FILE LINK
            </Button>
          </div>
        </div>
      </Card>

      {/* PAYMENT MODAL */}

      <Dialog
        open={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
      >
        <DialogContent className="overflow-hidden rounded-2xl border border-border/80 bg-card/95 p-0 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:max-w-[440px]"
        >
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div className="paymodal-glow-a absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-[70px]" />

              <div className="paymodal-glow-b absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-primary/[0.06] blur-[70px]" />
            </div>

            <div className="paymodal-panel-in relative z-10 p-6">
              <DialogHeader className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/15">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                  </span>

                  <DialogTitle className="text-lg font-bold tracking-tight">
                    Choose Payment Method
                  </DialogTitle>
                </div>

                <DialogDescription className="pl-[46px] text-sm">
                  {product.name} —{" "}
                  <span className="font-semibold text-primary">
                    {selectedPrice?.duration}
                  </span>{" "}
                  <span className="font-mono">
                    ({formattedPrice})
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="my-5 grid gap-3">
                {/* WALLET */}

                <button
                  disabled={isProcessing}
                  onClick={handleWalletPayment}
                  className="group/opt relative flex items-center justify-between overflow-hidden rounded-xl border border-border/60 bg-secondary/30 p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="relative z-10 flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all group-hover/opt:bg-primary group-hover/opt:text-primary-foreground">
                      <Wallet className="h-5 w-5" />
                    </span>

                    <span>
                      <span className="block text-sm font-semibold">
                        Pay Using Wallet
                      </span>

                      <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                        Balance: ₹
                        {walletBalance.toFixed(2)}
                      </span>
                    </span>
                  </span>

                  <span className="relative z-10 flex items-center gap-2">
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-500">
                      Instant
                    </span>

                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover/opt:translate-x-0 group-hover/opt:opacity-100" />
                  </span>
                </button>

                {/* UPI */}

                <button
                  disabled={isProcessing}
                  onClick={handleUpiPayment}
                  className="group/opt relative flex items-center justify-between overflow-hidden rounded-xl border border-border/60 bg-secondary/30 p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="relative z-10 flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all group-hover/opt:bg-primary group-hover/opt:text-primary-foreground">
                      <QrCode className="h-5 w-5" />
                    </span>

                    <span>
                      <span className="block text-sm font-semibold">
                        Instant UPI Payment
                      </span>

                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Scan QR Code &amp; Enter UTR
                      </span>
                    </span>
                  </span>

                  <ChevronRight className="relative z-10 h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover/opt:translate-x-0 group-hover/opt:opacity-100" />
                </button>
              </div>

              {isProcessing && (
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/20 px-4 py-3">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />

                  <div className="flex-1">
                    <p className="text-xs font-medium">
                      Processing your request…
                    </p>

                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border/50">
                      <div className="paymodal-progress h-full w-1/3 rounded-full bg-primary" />
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
        <DialogContent className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-card/95 p-0 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:max-w-[420px]"
        >
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div className="keycard-glow-a absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-[70px]" />

              <div className="keycard-glow-b absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-primary/[0.06] blur-[70px]" />
            </div>

            <div className="keycard-panel-in relative z-10 flex flex-col items-center p-6 text-center">
              <span className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15">
                <span className="keycard-ring pointer-events-none absolute inset-0 rounded-full border border-emerald-400/40" />

                <CheckCircle2 className="keycard-check-pop h-7 w-7 text-emerald-400" />
              </span>

              <DialogHeader className="items-center space-y-1.5">
                <DialogTitle className="text-lg font-bold">
                  Purchase Successful!
                </DialogTitle>

                <DialogDescription className="text-sm">
                  {product.name} —{" "}
                  <span className="font-semibold text-primary">
                    {selectedPrice?.duration}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="mt-5 w-full text-left">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Your Login Key
                </p>

                <div className="relative overflow-hidden rounded-xl border border-border/60 bg-secondary/30 p-4">
                  <div
                    aria-hidden
                    className="keycard-shimmer pointer-events-none absolute inset-0"
                  />

                  <p className="relative z-10 break-all font-mono text-sm">
                    {purchasedKey}
                  </p>
                </div>
              </div>

              <button
                onClick={handleCopyKeyAgain}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 py-2.5 text-sm font-semibold text-primary transition-all hover:bg-primary/20 active:scale-[0.98]"
              >
                {keyCopied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Key
                  </>
                )}
              </button>

              <button
                onClick={() => setShowKeyModal(false)}
                className="mt-1.5 w-full rounded-lg py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
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
                rgba(16, 185, 129, 0.14) 50%,
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
          <div className="toast-in pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-emerald-500/25 bg-card/95 px-4 py-3 text-sm font-medium text-foreground shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl">
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