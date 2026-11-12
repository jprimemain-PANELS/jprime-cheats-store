"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, KeyRound, ShieldCheck, ShoppingBag, Wallet, Check, Rocket } from "lucide-react";
import { useBrand } from "@/components/brand-provider";

type Purchase = { product_name: string; duration: string; key_code: string; price_paid?: string | number; created_at: string };
const ROLE_LABEL: Record<string, string> = { user: "Customer", reseller: "Reseller", vip_reseller: "VIP Reseller", "vip reseller": "VIP Reseller", vip: "VIP", coadmin: "Co-admin", admin: "Owner admin" };
const input = "w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-3 text-sm text-white outline-none focus:border-violet-500";

export default function ProfilePage() {
  const router = useRouter();
  const brand = useBrand();
  const [me, setMe] = useState<{ username: string; email?: string; role: string } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [rows, setRows] = useState<Purchase[] | null>(null);
  const [cur, setCur] = useState(""); const [next, setNext] = useState(""); const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [upBusy, setUpBusy] = useState(false);
  const [upMsg, setUpMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function upgrade() {
    if (!window.confirm(`Pay ₹${brand.options.upgradePrice} from your wallet and become a reseller?`)) return;
    setUpBusy(true); setUpMsg(null);
    try {
      const j = await (await fetch("/api/upgrade-reseller", { method: "POST" })).json();
      if (j.success) { setUpMsg({ ok: true, text: "You are now a reseller! Reload the page to see reseller prices." }); setBalance(Number(j.balance)); setMe((m) => (m ? { ...m, role: "reseller" } : m)); }
      else setUpMsg({ ok: false, text: j.error || "Could not upgrade." });
    } catch { setUpMsg({ ok: false, text: "Network error." }); }
    setUpBusy(false);
  }

  useEffect(() => {
    (async () => {
      try {
        const m = await (await fetch("/api/auth/me", { cache: "no-store" })).json();
        if (!m?.success) { router.replace("/login"); return; }
        setMe(m.user);
        const [w, p] = await Promise.all([
          fetch("/api/get-wallet", { method: "POST", cache: "no-store" }).then((r) => r.json()).catch(() => null),
          fetch("/api/get-purchases", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        ]);
        if (w?.success) setBalance(Number(w.balance));
        setRows(p?.success && Array.isArray(p.purchases) ? p.purchases : []);
      } catch { router.replace("/login"); }
    })();
  }, [router]);

  const total = useMemo(() => (rows ?? []).reduce((n, r) => n + (Number(r.price_paid) || 0), 0), [rows]);

  async function save() {
    setMsg(null);
    if (next.length < 8) return setMsg({ ok: false, text: "New password must be at least 8 characters." });
    if (next !== again) return setMsg({ ok: false, text: "The two new passwords are not the same." });
    setBusy(true);
    try {
      const r = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: cur, next }) });
      const j = await r.json();
      if (!r.ok || !j.success) setMsg({ ok: false, text: j.error || "Could not change the password." });
      else { setMsg({ ok: true, text: "Password changed." }); setCur(""); setNext(""); setAgain(""); }
    } catch { setMsg({ ok: false, text: "Network error." }); }
    setBusy(false);
  }

  if (!me) return <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm">Loading…</div>;
  const role = ROLE_LABEL[String(me.role).toLowerCase()] ?? me.role;

  return (
    <main className="min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white cursor-pointer"><ArrowLeft className="h-4 w-4" />Back to {brand.name}</button>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-xl font-bold text-white">{me.username.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-white">@{me.username}</h1>
              <p className="truncate text-xs text-zinc-400">{me.email || "No email on file"}</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-fuchsia-300"><ShieldCheck className="h-3 w-3" />{role}</span>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-black/30 p-3"><Wallet className="mx-auto mb-1 h-4 w-4 text-fuchsia-400" /><p className="text-sm font-bold text-white">₹{balance === null ? "—" : balance.toFixed(2)}</p><p className="text-[10px] text-zinc-500">Wallet</p></div>
            <div className="rounded-xl bg-black/30 p-3"><ShoppingBag className="mx-auto mb-1 h-4 w-4 text-fuchsia-400" /><p className="text-sm font-bold text-white">{rows ? rows.length : "—"}</p><p className="text-[10px] text-zinc-500">Purchases</p></div>
            <div className="rounded-xl bg-black/30 p-3"><span className="mx-auto mb-1 block text-sm leading-4 text-fuchsia-400">₹</span><p className="text-sm font-bold text-white">{rows ? total.toFixed(0) : "—"}</p><p className="text-[10px] text-zinc-500">Total spent</p></div>
          </div>
        </section>

        {brand.options.upgradeOn && String(me.role).toLowerCase() === "user" && (
          <section className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-5 space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Rocket className="h-4 w-4 text-amber-400" />Become a reseller</h2>
            <p className="text-xs text-zinc-300">Get reseller prices on products. One-time payment of <b>₹{brand.options.upgradePrice}</b> from your wallet.</p>
            {upMsg && <div className={`rounded-lg border px-3 py-2 text-xs ${upMsg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>{upMsg.text}</div>}
            <button onClick={upgrade} disabled={upBusy} className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-bold text-black disabled:opacity-50 cursor-pointer">{upBusy ? "Processing…" : `Upgrade for ₹${brand.options.upgradePrice}`}</button>
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><KeyRound className="h-4 w-4 text-fuchsia-400" />Change password</h2>
          {msg && <div className={`rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>{msg.text}</div>}
          <input className={input} type="password" autoComplete="current-password" placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} />
          <input className={input} type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={next} onChange={(e) => setNext(e.target.value)} />
          <input className={input} type="password" autoComplete="new-password" placeholder="Repeat new password" value={again} onChange={(e) => setAgain(e.target.value)} />
          <button onClick={save} disabled={busy || !cur || !next} className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer">{busy ? "Saving…" : "Save new password"}</button>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><ShoppingBag className="h-4 w-4 text-fuchsia-400" />Purchase history ({rows?.length ?? 0})</h2>
          {rows === null ? <p className="py-8 text-center text-xs text-zinc-500">Loading…</p> : rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-zinc-500">No purchases yet.</p>
          ) : (
            <div className="space-y-2.5">
              {rows.map((r, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{r.product_name}</p><p className="text-[11px] text-zinc-500">{r.duration} • {new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p></div>
                    {r.price_paid !== undefined && <span className="shrink-0 text-xs font-semibold text-fuchsia-300">₹{Number(r.price_paid) || 0}</span>}
                  </div>
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-black/30 p-2">
                    <p className="min-w-0 flex-1 break-all font-mono text-xs text-fuchsia-300 select-all">{r.key_code}</p>
                    <button onClick={() => { navigator.clipboard?.writeText(r.key_code); setCopied(i); setTimeout(() => setCopied(null), 1500); }} className="shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-xs text-zinc-200 cursor-pointer">{copied === i ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
