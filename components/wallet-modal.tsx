"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Wallet,
  Plus,
  History,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  IndianRupee,
  Phone,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";

interface WalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance: number;
  onBalanceUpdate?: (newBalance: number) => void;
}

interface Transaction {
  id: string;
  created_at: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
}

interface PaymentData {
  order_id: string;
  amount: number;
  upi_id: string;
  qr_url: string;
  gateway?: string;
  // false => no UTR needed; payment is detected automatically (anuj gateway)
  needs_utr?: boolean;
}

const MIN_DEPOSIT_AMOUNT = 1;
const PRESET_AMOUNTS = [100, 500, 1000, 2000, 5000];
const STEPS = ["Wallet", "Deposit", "Confirm"] as const;

// Confetti pieces for the "payment received" celebration (fixed values: no randomness).
const CONFETTI_COLORS = ["#d946ef", "#8b5cf6", "#34d399", "#fbbf24", "#f472b6", "#60a5fa"];
const CONFETTI = Array.from({ length: 22 }, (_, i) => {
  const angle = (i / 22) * Math.PI * 2 + (i % 2 ? 0.2 : 0);
  const dist = 78 + (i % 4) * 20;
  return {
    dx: Math.round(Math.cos(angle) * dist),
    dy: Math.round(Math.sin(angle) * dist) - 18,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: (i % 7) * 0.035,
    w: 5 + (i % 3) * 2,
    h: 8 + (i % 2) * 4,
    rot: 180 + (i % 5) * 90,
  };
});

type Notice = { type: "error" | "success" | "warning" | "info"; message: string } | null;

/** Helper function to safely parse current user from LocalStorage */
function getStoredUsername(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.username || null;
  } catch {
    return null;
  }
}

export function WalletModal({ open, onOpenChange, balance, onBalanceUpdate }: WalletModalProps) {
  const [showDeposit, setShowDeposit] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [displayedBalance, setDisplayedBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [utr, setUtr] = useState("");

  const [historyList, setHistoryList] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [notice, setNotice] = useState<Notice>(null);
  const [copied, setCopied] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false);
  const [verified, setVerified] = useState(false);
  const verifyingRef = useRef(false);
  const [credited, setCredited] = useState<{ amount: string; from: number; to: number | null } | null>(null);
  const [creditedShown, setCreditedShown] = useState(0);

  const step = showQR ? 2 : showDeposit || showHistory ? 1 : 0;

  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNotice(null);
    setAmount(e.target.value.replace(/\D/g, ""));
  };

  const handleAmountBlur = () => {
    setAmount((prev) => {
      const parsed = parseInt(prev, 10);
      if (Number.isNaN(parsed) || parsed < MIN_DEPOSIT_AMOUNT) {
        return String(MIN_DEPOSIT_AMOUNT);
      }
      return String(parsed);
    });
  };

  // Balance counter ease animation
  useEffect(() => {
    if (!open) return;

    let frame = 0;
    const start = performance.now();
    const duration = 900;

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayedBalance(balance * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [open, balance]);

  // New-balance count-up on the success screen
  useEffect(() => {
    if (!credited || credited.to === null) return;

    let frame = 0;
    const start = performance.now() + 450; // wait for the check animation
    const duration = 900;
    const { from, to } = credited;
    setCreditedShown(from);

    function tick(now: number) {
      const progress = Math.min(Math.max((now - start) / duration, 0), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCreditedShown(from + (to - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [credited]);

  // Reset states when dialog closes
  useEffect(() => {
    if (!open) {
      setNotice(null);
      setCopied(false);
      setQrLoaded(false);
      setVerified(false);
      setShowDeposit(false);
      setShowQR(false);
      setShowHistory(false);
      setPaymentData(null);
      setAmount("");
      setMobileNumber("");
      setUtr("");
      verifyingRef.current = false;
      setCredited(null);
    }
  }, [open]);

  const resetFormAndCloseFields = () => {
    setShowQR(false);
    setShowDeposit(false);
    setShowHistory(false);
    setPaymentData(null);
    setAmount("");
    setMobileNumber("");
    setUtr("");
    setVerified(false);
    setCredited(null);
    setNotice(null);
  };

  async function fetchWalletHistory() {
    try {
      setHistoryLoading(true);
      setNotice(null);

      const username = getStoredUsername();
      if (!username) {
        setNotice({ type: "error", message: "You must be logged in to view history." });
        return;
      }

      const response = await fetch(`/api/wallet-history?username=${encodeURIComponent(username)}`);
      const data = await response.json();

      if (data.success) {
        setHistoryList(data.transactions || []);
      } else {
        setNotice({ type: "error", message: data.message || "Failed loading statement history ledger logs." });
      }
    } catch (err) {
      console.error(err);
      setNotice({ type: "error", message: "System failure generating database synchronization check logs." });
    } finally {
      setHistoryLoading(false);
    }
  }

  async function createWalletOrder() {
    try {
      if (!amount || parseInt(amount, 10) < MIN_DEPOSIT_AMOUNT) {
        setNotice({ type: "error", message: `Minimum deposit amount is ₹${MIN_DEPOSIT_AMOUNT}.` });
        return;
      }

      setLoading(true);
      setNotice(null);

      const username = getStoredUsername();
      if (!username) {
        setNotice({ type: "error", message: "User session not found. Please re-login." });
        return;
      }

      const response = await fetch("/api/create-wallet-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          amount,
          mobile_number: mobileNumber,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setNotice({ type: "error", message: data.error || data.message || "Unable to create payment." });
        return;
      }

      setQrLoaded(false);
      setPaymentData(data.payment);
      setShowQR(true);
    } catch (err) {
      console.error(err);
      setNotice({ type: "error", message: "Something went wrong while generating the order." });
    } finally {
      setLoading(false);
    }
  }

  /**
   * Verifies the current deposit.
   * Returns true while automatic checking should keep going (gateways without UTR).
   */
  async function verifyWalletPayment(auto = false): Promise<boolean> {
    const needsUtr = paymentData?.needs_utr !== false;
    if (verifyingRef.current) return true;

    const cleanedUtr = utr.trim();
    if (needsUtr && (!cleanedUtr || cleanedUtr.length < 10)) {
      setNotice({ type: "error", message: "Please enter a valid 10+ digit UTR number." });
      return false;
    }

    verifyingRef.current = true;
    // Automatic checks stay silent so the QR code and buttons don't flicker.
    if (!auto) {
      setLoading(true);
      setNotice(null);
    }

    try {
      const response = await fetch("/api/verify-wallet-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          needsUtr
            ? { gateway_order_id: paymentData?.order_id, utr: cleanedUtr }
            : { gateway_order_id: paymentData?.order_id }
        ),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success === true && data.status === "success") {
        setCredited({
          amount: String(paymentData?.amount ?? ""),
          from: Number(balance) || 0,
          to: typeof data.balance !== "undefined" ? Number(data.balance) : null,
        });
        setVerified(true);
        setNotice({ type: "success", message: data.message || "Wallet balance credited successfully!" });

        if (onBalanceUpdate && typeof data.balance !== "undefined") {
          onBalanceUpdate(Number(data.balance));
        }

        setTimeout(() => {
          resetFormAndCloseFields();
        }, 5000);
        return false;
      }

      const status = String(data.status || "");

      if (status === "pending") {
        if (!auto) {
          setNotice({ type: "warning", message: data.message || "Payment remains inside processing state." });
        }
        return true;
      }

      switch (status) {
        case "invalid_utr":
          setNotice({ type: "error", message: data.message || "Invalid UTR input verified by bank network." });
          break;
        case "already_verified":
          setNotice({ type: "info", message: data.message || "This deposit has already been credited." });
          break;
        case "amount_mismatch":
          setNotice({ type: "error", message: data.message || "Deposited amount value discrepancy." });
          break;
        case "duplicate_utr":
          setNotice({ type: "error", message: data.message || "This UTR was already applied to another payment." });
          break;
        case "expired":
          setNotice({ type: "warning", message: data.message || "This payment session expired. Please start a new deposit." });
          break;
        case "manual_review":
          setNotice({ type: "warning", message: data.message || "This payment needs a manual check. Contact support." });
          break;
        default:
          // Temporary problems during automatic checks are retried silently.
          if (!auto) {
            setNotice({ type: "error", message: data.message || "Payment verification failed." });
          }
      }

      const stop = ["already_verified", "amount_mismatch", "duplicate_utr", "manual_review", "expired", "not_found", "invalid_request"].includes(status);
      return !stop;
    } catch (err) {
      console.error(err);
      if (!auto) {
        setNotice({ type: "error", message: "Critical error connecting to verification server." });
      }
      return true;
    } finally {
      verifyingRef.current = false;
      if (!auto) setLoading(false);
    }
  }

  // Gateways without UTR: check for the payment automatically while the QR screen is open.
  useEffect(() => {
    if (!open || !showQR || verified || !paymentData || paymentData.needs_utr !== false) return;

    let cancelled = false;
    let timer = 0;

    const tick = async () => {
      if (cancelled) return;
      const keepGoing = await verifyWalletPayment(true);
      if (!cancelled && keepGoing) timer = window.setTimeout(tick, 5000);
    };

    timer = window.setTimeout(tick, 4000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, showQR, verified, paymentData]);

  function handleCopyUpi() {
    if (!paymentData?.upi_id) return;
    navigator.clipboard.writeText(paymentData.upi_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden rounded-3xl border border-violet-500/20 bg-[#0b0714] p-0 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_80px_-20px_rgba(0,0,0,0.8)]">
        {/* Ambient backdrop */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="wallet-mesh absolute inset-0" />
          <div className="wallet-glow-a absolute -top-20 -right-14 h-56 w-56 rounded-full bg-fuchsia-500/15 blur-[70px]" />
          <div className="wallet-glow-b absolute -bottom-20 -left-14 h-56 w-56 rounded-full bg-violet-600/15 blur-[70px]" />
        </div>

        <div className="relative z-10 flex max-h-[90vh] flex-col overflow-y-auto custom-scrollbar p-6">
          <DialogHeader className="sr-only">
            <DialogTitle>Wallet</DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="mb-5 flex items-center gap-2">
            {STEPS.map((label, i) => (
              <div key={label} className="flex flex-1 items-center gap-2">
                <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="wallet-step-fill absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                    style={{ width: i <= step ? "100%" : "0%" }}
                  />
                </div>
              </div>
            ))}
          </div>

          {!showDeposit && !showHistory ? (
            <div key="wallet-home" className="wallet-panel-in relative">
              <div className="flex items-center gap-2.5 text-white">
                <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/25">
                  <span className="wallet-ring absolute inset-0 rounded-xl border border-fuchsia-400/40" />
                  <Wallet className="wallet-float h-4 w-4 text-fuchsia-400" />
                </span>
                <span className="text-base font-semibold">My Wallet</span>
              </div>

              {/* Balance */}
              <div className="wallet-card relative mt-4 overflow-hidden rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-violet-500/[0.16] to-fuchsia-500/[0.05] p-5">
                <div className="wallet-glow-a pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-fuchsia-500/20 blur-2xl" />
                <div className="relative flex items-center gap-1.5">
                  <span className="wallet-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-fuchsia-300/90">
                    Current Balance
                  </p>
                </div>
                <h2 className="relative mt-2 font-mono text-[2.5rem] font-bold leading-none tabular-nums text-white">
                  ₹{displayedBalance.toFixed(2)}
                </h2>
              </div>

              {/* Actions */}
              <div className="mt-6 space-y-2.5">
                <button
                  onClick={() => setShowDeposit(true)}
                  style={{ animationDelay: "70ms" }}
                  className="wallet-panel-in group flex w-full items-center justify-between rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/[0.08] px-4 py-4 transition-all duration-300 ease-out hover:bg-fuchsia-500/[0.14] hover:border-fuchsia-500/40 hover:shadow-[0_0_30px_-10px_rgba(217,70,239,0.5)] active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fuchsia-500/15 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-90">
                      <Plus className="h-4 w-4 text-fuchsia-400" />
                    </div>
                    <span className="text-sm font-medium text-white">Add Money</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-fuchsia-400 transition-transform duration-300 ease-out group-hover:translate-x-1" />
                </button>

                <button
                  onClick={() => {
                    setShowHistory(true);
                    fetchWalletHistory();
                  }}
                  style={{ animationDelay: "130ms" }}
                  className="wallet-panel-in group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 transition-all duration-300 ease-out hover:bg-white/[0.08] active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 transition-transform duration-300 ease-out group-hover:scale-110">
                      <History className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm font-medium text-white">Wallet History</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-neutral-500 transition-transform duration-300 ease-out group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          ) : showHistory ? (
            <div key="wallet-history" className="wallet-panel-in relative space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setNotice(null);
                    setShowHistory(false);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-all duration-200 hover:bg-white/5 hover:text-white active:scale-90"
                  aria-label="Back to wallet"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <h2 className="flex-1 text-center text-[15px] font-semibold text-white pr-8">
                  Statement Transaction History
                </h2>
              </div>

              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                  <Loader2 className="h-6 w-6 animate-spin text-fuchsia-400" />
                  <p className="mt-2 text-xs">Synchronizing ledger lines...</p>
                </div>
              ) : historyList.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-white/[0.01] py-12 text-center text-sm text-neutral-500">
                  No wallet transactions found.
                </div>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                  {historyList.map((tx) => {
                    const txDate = new Date(tx.created_at);
                    return (
                      <div key={tx.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-white">
                            {tx.type || "Transaction"}
                          </p>
                          <p className="mt-0.5 text-[10px] text-neutral-500">
                            {txDate.toLocaleDateString("en-IN")} • {txDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {tx.description && (
                            <p className="mt-1 text-[11px] text-neutral-400 line-clamp-1">{tx.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className={`font-mono text-xs font-bold ${tx.type === "deposit" ? "text-emerald-400" : "text-rose-400"}`}>
                            {tx.type === "deposit" ? "+" : "-"}₹{Number(tx.amount).toFixed(2)}
                          </p>
                          <p className="text-[9px] font-mono text-neutral-600">Post: ₹{Number(tx.balance_after).toFixed(2)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {notice && (
                <div className="wallet-notice-in flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{notice.message}</span>
                </div>
              )}
            </div>
          ) : !showQR ? (
            <div key="wallet-deposit" className="wallet-panel-in relative space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setNotice(null);
                    setShowDeposit(false);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-all duration-200 hover:bg-white/5 hover:text-white active:scale-90"
                  aria-label="Back to wallet"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <h2 className="flex-1 text-center text-[15px] font-semibold text-white pr-8">
                  Instant UPI Deposit
                </h2>
              </div>

              <button
                onClick={() => window.open("https://youtube.com/@jprimepanel", "_blank")}
                style={{ animationDelay: "50ms" }}
                className="wallet-panel-in group flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] py-3 text-sm font-semibold text-amber-300 transition-all duration-300 ease-out hover:bg-amber-500/15 active:scale-[0.98]"
              >
                <HelpCircle className="h-4 w-4 transition-transform duration-300 ease-out group-hover:rotate-12" />
                How to deposit?
              </button>

              <div style={{ animationDelay: "100ms" }} className="wallet-panel-in">
                <label className="mb-2 block text-sm text-neutral-400">Amount (₹)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                  <input
                    type="number"
                    inputMode="numeric"
                    min={MIN_DEPOSIT_AMOUNT}
                    step={1}
                    value={amount}
                    onChange={handleAmountChange}
                    onBlur={handleAmountBlur}
                    placeholder="Enter amount"
                    className="w-full rounded-lg border border-white/10 bg-[#120c1f] pl-10 pr-3 py-3 font-mono text-white outline-none transition-all duration-200 focus:border-fuchsia-500/50 focus:ring-2 focus:ring-fuchsia-500/15"
                  />
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {PRESET_AMOUNTS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setNotice(null);
                        setAmount(String(preset));
                      }}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 active:scale-95 ${
                        amount === String(preset)
                          ? "border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-300"
                          : "border-white/10 bg-white/[0.03] text-neutral-400 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      ₹{preset.toLocaleString("en-IN")}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ animationDelay: "150ms" }} className="wallet-panel-in">
                <label className="mb-2 block text-sm text-neutral-400">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => {
                      setNotice(null);
                      setMobileNumber(e.target.value.replace(/\D/g, "").slice(0, 10));
                    }}
                    placeholder="Your 10-digit mobile number"
                    className="w-full rounded-lg border border-white/10 bg-[#120c1f] pl-10 pr-3 py-3 text-white outline-none transition-all duration-200 focus:border-fuchsia-500/50 focus:ring-2 focus:ring-fuchsia-500/15"
                  />
                </div>
              </div>

              {notice && (
                <div
                  className={`wallet-notice-in flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm ${
                    notice.type === "error"
                      ? "border-red-500/25 bg-red-500/10 text-red-300"
                      : notice.type === "warning"
                      ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                      : "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-300"
                  }`}
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{notice.message}</span>
                </div>
              )}

              <button
                onClick={createWalletOrder}
                disabled={loading}
                style={{ animationDelay: "200ms" }}
                className="wallet-shimmer wallet-panel-in relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-[0_8px_30px_-8px_rgba(192,38,211,0.7)] transition-all duration-300 ease-out hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Creating Order..." : "Pay Instantly"}
                </span>
              </button>
            </div>
          ) : (
            <div key="wallet-qr" className="wallet-panel-in relative space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={resetFormAndCloseFields}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-all duration-200 hover:bg-white/5 hover:text-white active:scale-90"
                  aria-label="Cancel order and close screen"
                >
                  <X className="h-4 w-4" />
                </button>
                <h2 className="flex-1 text-center text-[15px] font-semibold text-white pr-8">
                  {verified ? "Payment Verified" : "Scan & Pay"}
                </h2>
              </div>

              {verified ? (
                <div className="wallet-panel-in wallet-success relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-9 text-center">
                  {/* soft glow behind the check */}
                  <span aria-hidden className="wallet-success-glow pointer-events-none absolute left-1/2 top-[78px] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/25 blur-3xl" />

                  {/* confetti burst */}
                  <div aria-hidden className="pointer-events-none absolute left-1/2 top-[78px]">
                    {CONFETTI.map((c, i) => (
                      <span
                        key={i}
                        className="wallet-confetti absolute block rounded-[2px]"
                        style={
                          {
                            width: c.w,
                            height: c.h,
                            background: c.color,
                            animationDelay: `${0.35 + c.delay}s`,
                            ["--dx" as string]: `${c.dx}px`,
                            ["--dy" as string]: `${c.dy}px`,
                            ["--rot" as string]: `${c.rot}deg`,
                          } as CSSProperties
                        }
                      />
                    ))}
                  </div>

                  {/* animated check */}
                  <div className="relative flex h-[84px] w-[84px] items-center justify-center">
                    <span aria-hidden className="wallet-success-ripple absolute inset-0 rounded-full border border-emerald-400/50" />
                    <span aria-hidden className="wallet-success-ripple absolute inset-0 rounded-full border border-emerald-400/40" style={{ animationDelay: "0.5s" }} />
                    <svg viewBox="0 0 84 84" className="relative h-[84px] w-[84px]">
                      <circle cx="42" cy="42" r="37" fill="rgba(16,185,129,0.12)" />
                      <circle
                        cx="42"
                        cy="42"
                        r="37"
                        fill="none"
                        stroke="#34d399"
                        strokeWidth="3"
                        strokeLinecap="round"
                        className="wallet-success-ring"
                        transform="rotate(-90 42 42)"
                      />
                      <path
                        d="M26 43.5 L37.5 55 L58 31"
                        fill="none"
                        stroke="#6ee7b7"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="wallet-success-tick"
                      />
                    </svg>
                  </div>

                  <div className="wallet-success-rise" style={{ animationDelay: "0.55s" }}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
                      Payment received
                    </p>
                    {credited?.amount ? (
                      <p className="mt-1 font-mono text-3xl font-bold text-white">
                        +₹{Number(credited.amount).toFixed(2)}
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm font-semibold text-white">Wallet credited automatically</p>
                  </div>

                  {credited && credited.to !== null && (
                    <div
                      className="wallet-success-rise mt-1 w-full max-w-[240px] rounded-xl border border-white/10 bg-black/25 px-4 py-2.5"
                      style={{ animationDelay: "0.8s" }}
                    >
                      <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">New balance</p>
                      <p className="font-mono text-lg font-bold tabular-nums text-emerald-300">
                        ₹{creditedShown.toFixed(2)}
                      </p>
                    </div>
                  )}

                  <p className="wallet-success-rise mt-1 text-xs text-neutral-400" style={{ animationDelay: "1.1s" }}>
                    Taking you back to your wallet…
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-fuchsia-500/25 bg-[#120c1f] p-4">
                    <div className="flex justify-center">
                      <div className="relative rounded-xl bg-white p-2.5">
                        {!qrLoaded && (
                          <div className="wallet-skeleton absolute inset-2.5 rounded-lg" />
                        )}
                        {paymentData?.qr_url && (
                          <img
                            src={paymentData.qr_url}
                            alt="QR Code"
                            onLoad={() => setQrLoaded(true)}
                            className={`h-48 w-48 object-contain transition-opacity duration-300 ${
                              qrLoaded ? "opacity-100" : "opacity-0"
                            }`}
                          />
                        )}
                      </div>
                    </div>

                    <div className="mt-4 space-y-2.5">
                      <div className="flex items-center justify-between rounded-lg bg-black/25 p-2.5">
                        <span className="text-sm text-neutral-400">Amount</span>
                        <span className="font-mono font-bold text-white">₹{paymentData?.amount}</span>
                      </div>
                      <p className="px-1 text-[11px] text-amber-300/90">
                        Pay this exact amount (including paise) so the payment can be matched.
                      </p>

                      <div className="rounded-lg bg-black/25 p-2.5">
                        <p className="text-xs text-neutral-400">UPI ID</p>
                        <p className="mt-0.5 break-all text-xs tracking-wide text-white">
                          {paymentData?.upi_id}
                        </p>
                      </div>

                      <button
                        onClick={handleCopyUpi}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/10 py-2.5 text-sm font-semibold text-fuchsia-300 transition-all duration-200 hover:bg-fuchsia-500/20 active:scale-[0.98]"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" /> Copy UPI ID
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {paymentData?.needs_utr !== false ? (
                    <div>
                      <label className="mb-1.5 block text-xs text-neutral-400">Enter UTR / Ref Number</label>
                      <input
                        value={utr}
                        onChange={(e) => {
                          setNotice(null);
                          setUtr(e.target.value.replace(/\D/g, "").slice(0, 12));
                        }}
                        placeholder="Enter 12-digit UTR"
                        className="w-full rounded-lg border border-white/10 bg-[#120c1f] px-4 py-2.5 text-sm font-mono text-white outline-none transition-all duration-200 focus:border-fuchsia-500"
                      />
                    </div>
                  ) : (
                    <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.05] px-3.5 py-3 text-center">
                      <p className="text-xs text-neutral-300">
                        No UTR needed. Pay the exact amount and your wallet is credited automatically.
                      </p>
                      <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-fuchsia-300/80">
                        Checking payment every few seconds…
                      </p>
                    </div>
                  )}

                  {notice && (
                    <div
                      className={`wallet-notice-in flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm ${
                        notice.type === "success"
                          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                          : notice.type === "warning"
                          ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                          : notice.type === "info"
                          ? "border-violet-500/25 bg-violet-500/10 text-violet-300"
                          : "border-red-500/25 bg-red-500/10 text-red-300"
                      }`}
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{notice.message}</span>
                    </div>
                  )}

                  <button
                    onClick={() => verifyWalletPayment(false)}
                    disabled={loading}
                    className="relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-bold text-white shadow-[0_8px_30px_-8px_rgba(192,38,211,0.7)] transition-all duration-300 ease-out hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {loading ? "Verifying..." : paymentData?.needs_utr === false ? "Check Payment Status" : "Verify Payment"}
                    </span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <style jsx>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(192, 38, 211, 0.3);
            border-radius: 9999px;
          }

          .wallet-mesh {
            background-image: radial-gradient(
                circle at 20% 15%,
                rgba(139, 92, 246, 0.08),
                transparent 55%
              ),
              radial-gradient(circle at 85% 85%, rgba(217, 70, 239, 0.07), transparent 55%);
            background-size: 200% 200%;
            animation: walletMeshDrift 14s ease-in-out infinite;
          }

          @keyframes walletMeshDrift {
            0%, 100% { background-position: 0% 0%, 100% 100%; }
            50% { background-position: 15% 10%, 85% 90%; }
          }
          @keyframes walletGlowA {
            0%, 100% { opacity: 0.5; transform: scale(1); }
            50% { opacity: 0.9; transform: scale(1.15); }
          }
          @keyframes walletGlowB {
            0%, 100% { opacity: 0.4; transform: scale(1); }
            50% { opacity: 0.75; transform: scale(1.1); }
          }
          @keyframes walletRingPulse {
            0% { transform: scale(1); opacity: 0.7; }
            70%, 100% { transform: scale(1.5); opacity: 0; }
          }
          @keyframes walletFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-2px); }
          }
          @keyframes walletPanelIn {
            0% { opacity: 0; transform: translateY(10px) scale(0.99); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes walletNoticeIn {
            0% { opacity: 0; transform: translateY(-4px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes walletCheckPop {
            0% { opacity: 0; transform: scale(0.4); }
            60% { opacity: 1; transform: scale(1.08); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes walletLiveDot {
            0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.5); }
            50% { opacity: 0.6; box-shadow: 0 0 0 4px rgba(52, 211, 153, 0); }
          }

          @keyframes walletRingDraw {
            from { stroke-dashoffset: 233; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes walletTickDraw {
            from { stroke-dashoffset: 60; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes walletRipple {
            0% { transform: scale(0.9); opacity: 0.7; }
            100% { transform: scale(1.9); opacity: 0; }
          }
          @keyframes walletRise {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes walletConfetti {
            0% { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(0.4); }
            70% { opacity: 1; }
            100% { opacity: 0; transform: translate(var(--dx), calc(var(--dy) + 46px)) rotate(var(--rot)) scale(1); }
          }
          @keyframes walletSuccessGlow {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
            40% { opacity: 1; }
            100% { opacity: 0.55; transform: translate(-50%, -50%) scale(1); }
          }

          .wallet-success-ring {
            stroke-dasharray: 233;
            stroke-dashoffset: 233;
            animation: walletRingDraw 0.6s cubic-bezier(0.65, 0, 0.35, 1) 0.1s forwards;
          }
          .wallet-success-tick {
            stroke-dasharray: 60;
            stroke-dashoffset: 60;
            animation: walletTickDraw 0.4s cubic-bezier(0.65, 0, 0.35, 1) 0.6s forwards;
          }
          .wallet-success-ripple {
            opacity: 0;
            animation: walletRipple 1.5s ease-out 0.7s 2 forwards;
          }
          .wallet-success-rise {
            opacity: 0;
            animation: walletRise 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          .wallet-success-glow { animation: walletSuccessGlow 1s ease-out forwards; }
          .wallet-confetti {
            opacity: 0;
            animation: walletConfetti 1.25s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
          }

          @media (prefers-reduced-motion: reduce) {
            .wallet-success-ring, .wallet-success-tick { animation-duration: 0.01s; animation-delay: 0s; }
            .wallet-success-ripple, .wallet-confetti, .wallet-success-glow { animation: none; opacity: 0; }
            .wallet-success-rise { animation-duration: 0.01s; animation-delay: 0s; }
          }

          .wallet-glow-a { animation: walletGlowA 6s ease-in-out infinite; }
          .wallet-glow-b { animation: walletGlowB 8s ease-in-out infinite; }
          .wallet-ring { animation: walletRingPulse 2.5s ease-out infinite; }
          .wallet-float { animation: walletFloat 3s ease-in-out infinite; }
          .wallet-panel-in { animation: walletPanelIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
          .wallet-notice-in { animation: walletNoticeIn 0.25s ease-out forwards; }
          .wallet-check-pop { animation: walletCheckPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
          .wallet-live-dot { animation: walletLiveDot 2s ease-in-out infinite; }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}