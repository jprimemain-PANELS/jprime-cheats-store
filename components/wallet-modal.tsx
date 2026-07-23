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
import { useEffect, useState, type ChangeEvent } from "react";

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

const MIN_DEPOSIT_AMOUNT = 1;
const PRESET_AMOUNTS = [100, 500, 1000, 2000, 5000];
const STEPS = ["Wallet", "Deposit", "Confirm"] as const;

type Notice = { type: "error" | "success" | "warning" | "info"; message: string } | null;

export function WalletModal({ open, onOpenChange, balance, onBalanceUpdate }: WalletModalProps) {
  const [showDeposit, setShowDeposit] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [displayedBalance, setDisplayedBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [showQR, setShowQR] = useState(false);
  const [utr, setUtr] = useState("");

  const [historyList, setHistoryList] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [notice, setNotice] = useState<Notice>(null);
  const [copied, setCopied] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false);
  const [verified, setVerified] = useState(false);

  const step = showQR ? 2 : (showDeposit || showHistory) ? 1 : 0;

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
    setNotice(null);
  };

  async function fetchWalletHistory() {
    try {
      setHistoryLoading(true);
      setNotice(null);
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      
      if (!user.username) {
        setNotice({ type: "error", message: "You must be logged in to view history." });
        return;
      }

      const response = await fetch(`/api/wallet-history?username=${encodeURIComponent(user.username)}`);
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
      setLoading(true);
      setNotice(null);

      const user = JSON.parse(localStorage.getItem("user") || "{}");

      const response = await fetch("/api/create-wallet-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: user.username,
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

  async function verifyWalletPayment() {
    try {
      setLoading(true);
      setNotice(null);

      if (!utr.trim() || utr.trim().length < 10) {
        setNotice({ type: "error", message: "Please enter a valid 10+ digit UTR number." });
        setLoading(false);
        return;
      }

      const response = await fetch("/api/verify-wallet-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gateway_order_id: paymentData?.order_id,
          utr: utr.trim(),
        }),
      });

      const data = await response.json();

      // STRICT CHECK: Requires HTTP 200/OK response AND success field to be explicitly true
      if (response.ok && data.success === true && data.status === "success") {
        setVerified(true);
        setNotice({ type: "success", message: data.message || "Wallet balance credited successfully!" });
        
        if (onBalanceUpdate && typeof data.balance !== "undefined") {
          onBalanceUpdate(Number(data.balance));
        }

        setTimeout(() => {
          resetFormAndCloseFields();
        }, 2500);
      } else {
        // Fallback to specific status codes or server response messages
        switch (data.status) {
          case "invalid_utr":
            setNotice({ type: "error", message: data.message || "Invalid UTR input verified by bank network." });
            break;
          case "pending":
            setNotice({ type: "warning", message: data.message || "Payment remains inside processing state." });
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
          default:
            setNotice({ type: "error", message: data.message || "Payment verification failed." });
        }
      }
    } catch (err) {
      console.error(err);
      setNotice({ type: "error", message: "Critical error connecting to verification server." });
    } finally {
      setLoading(false);
    }
  }

  function handleCopyUpi() {
    navigator.clipboard.writeText(paymentData?.upi_id || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 bg-[#09090B] p-0 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_80px_-20px_rgba(0,0,0,0.8)]">
        {/* Ambient backdrop */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="wallet-mesh absolute inset-0" />
          <div className="wallet-glow-a absolute -top-20 -right-14 h-56 w-56 rounded-full bg-cyan-500/10 blur-[70px]" />
          <div className="wallet-glow-b absolute -bottom-20 -left-14 h-56 w-56 rounded-full bg-cyan-500/[0.07] blur-[70px]" />
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
                    className="wallet-step-fill absolute inset-y-0 left-0 rounded-full bg-cyan-400"
                    style={{ width: i <= step ? "100%" : "0%" }}
                  />
                </div>
              </div>
            ))}
          </div>

          {!showDeposit && !showHistory ? (
            <div key="wallet-home" className="wallet-panel-in relative">
              <div className="flex items-center gap-2.5 text-white">
                <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/20">
                  <span className="wallet-ring absolute inset-0 rounded-xl border border-cyan-400/40" />
                  <Wallet className="wallet-float h-4 w-4 text-cyan-400" />
                </span>
                <span className="text-base font-semibold">My Wallet</span>
              </div>

              {/* Balance */}
              <div className="wallet-card relative mt-4 overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.12] to-cyan-500/[0.03] p-5">
                <div className="wallet-glow-a pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-cyan-500/10 blur-2xl" />
                <div className="relative flex items-center gap-1.5">
                  <span className="wallet-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-300/90">
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
                  className="wallet-panel-in group flex w-full items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-500/[0.08] px-4 py-4 transition-all duration-300 ease-out hover:bg-cyan-500/[0.14] hover:border-cyan-500/35 hover:shadow-[0_0_30px_-10px_rgba(34,211,238,0.45)] active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-90">
                      <Plus className="h-4 w-4 text-cyan-400" />
                    </div>
                    <span className="text-sm font-medium text-white">Add Money</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-cyan-400 transition-transform duration-300 ease-out group-hover:translate-x-1" />
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
                  <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
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
                    className="w-full rounded-lg border border-white/10 bg-[#111114] pl-10 pr-3 py-3 font-mono text-white outline-none transition-all duration-200 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/10"
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
                          ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
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
                      setMobileNumber(e.target.value.replace(/\D/g, ""));
                    }}
                    placeholder="Your mobile number"
                    className="w-full rounded-lg border border-white/10 bg-[#111114] pl-10 pr-3 py-3 text-white outline-none transition-all duration-200 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/10"
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
                      : "border-cyan-500/25 bg-cyan-500/10 text-cyan-300"
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
                className="wallet-shimmer wallet-panel-in relative w-full overflow-hidden rounded-lg bg-cyan-500 py-3.5 text-sm font-bold uppercase tracking-wide text-black transition-all duration-300 ease-out hover:bg-cyan-400 active:scale-[0.98] disabled:opacity-60"
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
                <div className="wallet-panel-in flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-10 text-center">
                  <span className="wallet-check-pop flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                  </span>
                  <p className="text-sm font-semibold text-white">Wallet credited successfully</p>
                  <p className="text-xs text-neutral-400">Taking you back to your wallet…</p>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-cyan-500/20 bg-[#111114] p-4">
                    <div className="flex justify-center">
                      <div className="relative rounded-xl bg-white p-2.5">
                        {!qrLoaded && (
                          <div className="wallet-skeleton absolute inset-2.5 rounded-lg" />
                        )}
                        <img
                          src={paymentData?.qr_url}
                          alt="QR Code"
                          onLoad={() => setQrLoaded(true)}
                          className={`h-48 w-48 object-contain transition-opacity duration-300 ${
                            qrLoaded ? "opacity-100" : "opacity-0"
                          }`}
                        />
                      </div>
                    </div>

                    <div className="mt-4 space-y-2.5">
                      <div className="flex items-center justify-between rounded-lg bg-black/20 p-2.5">
                        <span className="text-sm text-neutral-400">Amount</span>
                        <span className="font-mono font-bold text-white">₹{paymentData?.amount}</span>
                      </div>

                      <div className="rounded-lg bg-black/20 p-2.5">
                        <p className="text-xs text-neutral-400">UPI ID</p>
                        <p className="mt-0.5 break-all text-xs tracking-wide text-white">
                          {paymentData?.upi_id}
                        </p>
                      </div>

                      <button
                        onClick={handleCopyUpi}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 py-2.5 text-sm font-semibold text-cyan-300 transition-all duration-200 hover:bg-cyan-500/20 active:scale-[0.98]"
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

                  <div>
                    <label className="mb-1.5 block text-xs text-neutral-400">Enter UTR Number</label>
                    <input
                      value={utr}
                      onChange={(e) => {
                        setNotice(null);
                        setUtr(e.target.value);
                      }}
                      placeholder="Enter 12-digit UTR"
                      className="w-full rounded-lg border border-white/10 bg-[#111114] px-4 py-2.5 text-sm text-white outline-none transition-all duration-200 focus:border-cyan-500"
                    />
                  </div>

                  {notice && (
                    <div
                      className={`wallet-notice-in flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm ${
                        notice.type === "success"
                          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                          : notice.type === "warning"
                          ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                          : notice.type === "info"
                          ? "border-blue-500/25 bg-blue-500/10 text-blue-300"
                          : "border-red-500/25 bg-red-500/10 text-red-300"
                      }`}
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{notice.message}</span>
                    </div>
                  )}

                  <button
                    onClick={verifyWalletPayment}
                    disabled={loading}
                    className="relative w-full overflow-hidden rounded-lg bg-cyan-500 py-3 text-sm font-bold text-black transition-all duration-300 ease-out hover:bg-cyan-400 active:scale-[0.98] disabled:opacity-60"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {loading ? "Verifying..." : "Verify Payment"}
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
            background: rgba(6, 182, 212, 0.2);
            border-radius: 9999px;
          }

          .wallet-mesh {
            background-image: radial-gradient(
                circle at 20% 15%,
                rgba(34, 211, 238, 0.05),
                transparent 55%
              ),
              radial-gradient(circle at 85% 85%, rgba(34, 211, 238, 0.05), transparent 55%);
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
          @keyframes walletShimmerSweep {
            0% { transform: translateX(-120%); }
            100% { transform: translateX(220%); }
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
          @keyframes walletSkeletonSweep {
            0% { background-position: -150% 0; }
            100% { background-position: 150% 0; }
          }
          @keyframes walletLiveDot {
            0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.5); }
            50% { opacity: 0.6; box-shadow: 0 0 0 4px rgba(52, 211, 153, 0); }
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