"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CheckCircle2, ChevronDown, Clock, Coins, Copy, Crown, Gift, Globe, History, Loader2, MapPin, Power, Trash2, Wallet as WalletIcon, RefreshCw, Rocket, ShieldCheck, Sparkles, Square, Users, Wallet } from "lucide-react";
import type { Product } from "@/lib/products";

const WALLET_BALANCE_EVENT = "wallet-balance-updated";
const rupees = (v: unknown) => Number(String(v ?? "").replace(/[^\d.]/g, "")) || 0;
type Region = { id: string; name: string; code: string };
type Group = { ref: string; clan: string; regionName: string; at: string; status: string; refunded: boolean; name?: string | null; ended?: boolean };

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok && !!j.success, j };
}

type View = { groupId: string; name: string | null; level: number | null; clanId: string | null; region: string | null; status: string | null; members: number | null; maxMembers: number | null; captain: string | null; totalGlory: number | null; groupGlory: number | null; bots: number | null; uptime: string | null; goalPercent: number | null; lastMatch: string | null; weeklyGlory: number | null };
const fmt = (n: number | null) => (n == null ? "–" : n.toLocaleString("en-IN"));
const isRunning = (s?: string | null) => /run|active|online|start/i.test(String(s ?? ""));

type Row = Record<string, string | number | boolean>;
const nice = (k: string) => k.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const niceVal = (v: string | number | boolean) => { const t = typeof v === "string" ? Date.parse(v) : NaN; return typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(t) ? new Date(t).toLocaleString("en-IN") : String(v); };

/** One live group card (like the seller's own dashboard): stats + Restart / Stop / Refresh / Match history / Players / Copy ID / Refund request / Delete. */
function GroupPanel({ g, onRemoved }: { g: Group; onRemoved: () => void }) {
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [list, setList] = useState<{ kind: "history" | "players"; rows: Row[] | null; error?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [refundAsked, setRefundAsked] = useState(false);

  const load = useCallback(async (force = false) => {
    if (g.ended) return;
    try {
      const j = await (await fetch(`/api/guild/group?ref=${encodeURIComponent(g.ref)}${force ? "&force=1" : ""}`, { cache: "no-store" })).json();
      if (j?.success) { setV(j.group); setErr(""); } else setErr(j?.error || "Could not load.");
    } catch { setErr("Network problem."); }
  }, [g.ref, g.ended]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 20000);
    return () => clearInterval(t);
  }, [load]);

  async function act(action: "restart" | "stop" | "refresh" | "delete" | "refund") {
    if (action === "stop" && !window.confirm("Stop this group? The bots will leave your guild.")) return;
    if (action === "delete" && !window.confirm("Delete this group from your list? It is stopped first. This cannot be undone.")) return;
    if (action === "refund" && !window.confirm("Send a refund request for this group to the admin?")) return;
    setBusy(action); setNote("");
    try {
      const { ok, j } = await post("/api/guild/group", { ref: g.ref, action });
      if (ok && action === "delete") { onRemoved(); return; }
      if (ok && action === "refund") setRefundAsked(true);
      setNote(ok ? (j.message || (action === "restart" ? "Restart sent." : action === "stop" ? "Stop sent." : "Refreshed.")) : j.error || "Action failed.");
      if (ok && action !== "refund") setTimeout(() => load(true), 1500);
    } catch { setNote("Network problem."); }
    setBusy("");
  }

  async function show(kind: "history" | "players") {
    if (list?.kind === kind) { setList(null); return; }
    setList({ kind, rows: null });
    try {
      const j = await (await fetch(`/api/guild/group?ref=${encodeURIComponent(g.ref)}&view=${kind}`, { cache: "no-store" })).json();
      setList({ kind, rows: j?.success ? j.rows : [], error: j?.success ? undefined : j?.error || "Could not load." });
    } catch { setList({ kind, rows: [], error: "Network problem." }); }
  }

  async function copyId() {
    try { await navigator.clipboard.writeText(v?.groupId || g.ref); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  }

  const status = g.ended ? "ended" : v?.status ?? g.status;
  const running = isRunning(status);
  const name = v?.name || g.name || null;
  const stat = "min-w-0";
  const lab = "flex items-center gap-1.5 text-[11px] text-slate-500";
  const val = "mt-0.5 break-words text-sm font-extrabold text-white";
  const btn = "flex min-h-10 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold disabled:opacity-40 cursor-pointer";

  return (
    <div className="space-y-3 rounded-2xl border border-amber-400/20 bg-[#0e0c07] p-3.5">
      <div className="flex items-center gap-3 rounded-xl border border-amber-400/20 bg-black/30 p-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-400/10 text-sm font-extrabold text-amber-200">{v?.level != null ? `LV.${v.level}` : <Crown className="h-5 w-5" />}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-extrabold text-white">{name || `Guild ${g.clan}`}</p>
          <p className="truncate text-[11px] text-slate-400">ID: {g.clan} · {g.regionName}{v?.bots != null ? ` · ${v.bots} BOTS` : ""}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Members</p><p className="text-sm font-extrabold text-white">{v?.members != null ? `${v.members}${v.maxMembers != null ? `/${v.maxMembers}` : ""}` : "–"}</p></div>
        <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Captain</p><p className="truncate text-sm font-extrabold text-amber-300">{v?.captain ?? "–"}</p></div>
        <div><p className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300/80"><Crown className="h-3 w-3" />Total glory</p><p className="text-lg font-extrabold leading-tight text-white">{fmt(v?.totalGlory ?? null)}</p></div>
      </div>

      <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 truncate text-xs text-slate-400"><ShieldCheck className="h-4 w-4 text-amber-300" />ID: <span className="text-slate-200">{String(v?.groupId ?? g.ref).slice(0, 14)}</span></p>
          <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase ${running ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : g.ended || g.refunded ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}><span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-emerald-400" : g.ended || g.refunded ? "bg-rose-400" : "bg-amber-400"}`} />{g.refunded ? "refunded" : status || "starting"}</span>
        </div>

        {g.ended ? (
          <p className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">This group is no longer active on the service. If you were charged and it never started, use Request Refund.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className={stat}><p className={lab}><ShieldCheck className="h-3.5 w-3.5" />Accounts</p><p className={val}>{v?.bots ?? "–"}</p></div>
            <div className={stat}><p className={lab}><Clock className="h-3.5 w-3.5" />Uptime</p><p className={val}>{v?.uptime ?? "–"}</p></div>
            <div className={stat}><p className={lab}><History className="h-3.5 w-3.5" />Last match</p><p className={val}>{v?.lastMatch ? niceVal(v.lastMatch) : "–"}</p></div>
            <div className={stat}><p className={lab}><Users className="h-3.5 w-3.5" />Clan ID</p><p className={val}>{g.clan}</p></div>
            <div className={stat}><p className={lab}><Crown className="h-3.5 w-3.5" />Weekly glory</p><p className={val}>{fmt(v?.weeklyGlory ?? v?.groupGlory ?? null)}</p></div>
          </div>
        )}
        {v?.goalPercent != null && !g.ended && (
          <div>
            <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500"><span>8h goal</span><span>{Math.round(v.goalPercent)}%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-amber-400 transition-all duration-700" style={{ width: `${v.goalPercent}%` }} /></div>
          </div>
        )}
        {err && !v && !g.ended && <p className="text-xs text-slate-500">{err}</p>}
        {note && <p className="text-xs text-amber-300">{note}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => act("restart")} disabled={!!busy || g.refunded || g.ended} className={`${btn} border-white/10 bg-white/[0.04] text-slate-200`}>{busy === "restart" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}Restart</button>
          <button onClick={() => act("stop")} disabled={!!busy || g.refunded || g.ended} className={`${btn} border-rose-500/30 bg-rose-500/10 text-rose-300`}>{busy === "stop" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-3.5 w-3.5" />}Stop</button>
          <button onClick={() => { act("refresh"); }} disabled={!!busy || g.ended} className={`${btn} border-transparent bg-gradient-to-r from-[#f1d9a0] to-[#d4a94c] text-[#2b1d03]`}>{busy === "refresh" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Refresh</button>
          <button onClick={() => show("history")} disabled={g.ended} className={`${btn} border-sky-500/30 bg-sky-500/10 text-sky-300`}><Clock className="h-4 w-4" />Match History</button>
          <button onClick={copyId} className={`${btn} border-white/10 bg-white/[0.04] text-slate-200`}>{copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy ID"}</button>
          <button onClick={() => act("refund")} disabled={!!busy || refundAsked} className={`${btn} border-emerald-500/30 bg-emerald-500/10 text-emerald-300`}>{busy === "refund" ? <Loader2 className="h-4 w-4 animate-spin" /> : <WalletIcon className="h-4 w-4" />}{refundAsked ? "Refund requested" : "Request Refund"}</button>
          <button onClick={() => act("delete")} disabled={!!busy || g.ended} className={`${btn} col-span-2 border-rose-500/30 bg-rose-500/10 text-rose-300`}>{busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Delete Group</button>
          <button onClick={() => show("players")} disabled={g.ended} className={`${btn} col-span-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-300`}><Users className="h-4 w-4" />Players Info</button>
        </div>

        {list && (
          <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">{list.kind === "history" ? "Match history" : "Players"}</p>
            {list.rows === null ? <p className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading…</p>
              : list.error ? <p className="text-xs text-rose-300">{list.error}</p>
              : list.rows.length === 0 ? <p className="text-xs text-slate-500">Nothing to show yet.</p>
              : list.rows.map((r, i) => (
                <div key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-xs">
                  {Object.entries(r).map(([k, val2]) => <span key={k} className="text-slate-300"><span className="text-slate-500">{nice(k)}:</span> {niceVal(val2)}</span>)}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

const LAUNCH_STEPS = ["Checking your region…", "Guild found ✓", "Bot players are being added to your guild…", "Almost ready to launch…"];

/**
 * Guild Glory: 1) buy tokens with the wallet  2) redeem a token into guild credits (shown top-right)
 * 3) enter region + Guild ID and launch. Everything is validated again on the server.
 */
export function GuildGloryCard({ product }: { product: Product }) {
  const [duration, setDuration] = useState(product.prices[0]?.duration ?? "");
  const [role, setRole] = useState("user");
  const [loggedIn, setLoggedIn] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [connected, setConnected] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [more, setMore] = useState(false);

  const [buying, setBuying] = useState(false);
  const [bought, setBought] = useState<{ code: string; credits: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [region, setRegion] = useState("");
  const [guildId, setGuildId] = useState("");
  const [launching, setLaunching] = useState(false);
  const [stage, setStage] = useState(0);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; where: "buy" | "redeem" | "launch" } | null>(null);

  const loadMe = useCallback(async () => {
    try {
      const j = await (await fetch("/api/guild/me", { cache: "no-store" })).json();
      if (j?.success) { setCredits(Number(j.credits) || 0); setRegions(j.regions || []); setGroups(j.groups || []); setConnected(!!j.connected); }
    } catch {}
  }, []);

  useEffect(() => {
    let live = true;
    fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (!live) return;
      if (j?.success && j.user) { const r = String(j.user.role || "user").toLowerCase(); setRole(r === "reseller" || r === "admin" ? r : "user"); setLoggedIn(true); loadMe(); } else setLoggedIn(false);
    }).catch(() => {});
    fetch("/api/get-wallet", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (live && j?.success) setBalance(Number(j.balance) || 0); }).catch(() => {});
    const onBal = (e: Event) => { const b = Number((e as CustomEvent).detail?.balance); if (Number.isFinite(b)) setBalance(b); };
    window.addEventListener(WALLET_BALANCE_EVENT, onBal);
    return () => { live = false; window.removeEventListener(WALLET_BALANCE_EVENT, onBal); };
  }, [loadMe]);

  const tier = product.prices.find((p) => p.duration === duration) ?? product.prices[0];
  const priceOf = (t?: { priceINR: string; resellerPrice?: string }) => (t ? (role === "reseller" && t.resellerPrice ? rupees(t.resellerPrice) : rupees(t.priceINR)) : 0);
  const maintenance = product.status === "MAINTENANCE";
  const features = more ? product.features : product.features.slice(0, 4);
  const field = "w-full rounded-2xl border border-slate-700/70 bg-[#0b1426] px-4 py-3.5 text-base font-semibold text-white outline-none focus:border-amber-400/70";
  const say = (where: "buy" | "redeem" | "launch", kind: "ok" | "err", text: string) => setMsg({ where, kind, text });
  const shareBalance = (b: unknown) => { const n = Number(b); if (Number.isFinite(n)) { setBalance(n); window.dispatchEvent(new CustomEvent(WALLET_BALANCE_EVENT, { detail: { balance: n } })); } };

  async function buy() {
    setMsg(null);
    if (!loggedIn) return say("buy", "err", "Please log in first.");
    setBuying(true);
    try {
      const { ok, j } = await post("/api/guild/buy", { product_name: product.name, duration });
      if (ok) { shareBalance(j.newBalance); setBought({ code: j.code, credits: j.credits }); setCopied(false); }
      else { if (Number.isFinite(Number(j.newBalance))) setBalance(Number(j.newBalance)); say("buy", "err", j.error || "Could not buy the token."); }
    } catch { say("buy", "err", "Network problem. Please try again."); }
    setBuying(false);
  }

  async function copyCode() {
    if (!bought) return;
    try { await navigator.clipboard.writeText(bought.code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { say("buy", "err", "Copy failed. Select the code and copy it."); }
  }

  async function redeem() {
    setMsg(null);
    if (!loggedIn) return say("redeem", "err", "Please log in first.");
    const code = redeemCode.trim();
    if (!code) return say("redeem", "err", "Paste your token first.");
    setRedeeming(true);
    try {
      const { ok, j } = await post("/api/guild/redeem", { code });
      if (ok) { setCredits(Number(j.credits) || 0); setRedeemCode(""); if (bought && bought.code === code.toUpperCase()) setBought(null); say("redeem", "ok", `+${j.added} credit${j.added === 1 ? "" : "s"} added.`); }
      else say("redeem", "err", j.error || "Could not redeem.");
    } catch { say("redeem", "err", "Network problem. Please try again."); }
    setRedeeming(false);
  }

  async function launch() {
    setMsg(null);
    if (!loggedIn) return say("launch", "err", "Please log in first.");
    if (!region) return say("launch", "err", "Choose your account region.");
    if (!/^[0-9]{5,20}$/.test(guildId.trim())) return say("launch", "err", "Enter the correct Guild / Clan ID (numbers only).");
    setLaunching(true); setStage(0);
    const timer = setInterval(() => setStage((n) => Math.min(n + 1, LAUNCH_STEPS.length - 1)), 2200);
    try {
      const { ok, j } = await post("/api/guild/launch", { product_name: product.name, region, guild_id: guildId.trim() });
      if (ok) { setCredits(Number(j.credits) || 0); say("launch", "ok", `${j.message} Order ID: ${j.ref}`); setGuildId(""); loadMe(); }
      else { if (Number.isFinite(Number(j.credits))) setCredits(Number(j.credits)); say("launch", "err", j.error || "Could not start the bot."); }
    } catch { say("launch", "err", "Network problem. Please try again."); }
    clearInterval(timer);
    setLaunching(false);
  }

  const note = (where: "buy" | "redeem" | "launch") =>
    msg && msg.where === where ? (
      <p className={`rounded-xl border px-3 py-2 text-sm ${msg.kind === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>{msg.text}</p>
    ) : null;
  const label = "mb-2 flex items-center gap-2.5 text-base font-bold text-white";
  const step = "text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300/80";

  return (
    <div className="rounded-[28px] border border-slate-700/60 bg-[#14110a] p-5 sm:p-6 shadow-[0_0_60px_-20px_rgba(251,191,36,0.25)]" style={{ backgroundImage: "radial-gradient(120% 80% at 50% 0%, rgba(251,191,36,0.07), transparent 60%)" }}>
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#1d2a24]"><Sparkles className="h-8 w-8 text-sky-300" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-extrabold leading-tight text-white">{product.name}</h3>
          <p className="mt-1 text-sm text-slate-400">Buy tokens, redeem them, then enter your Guild ID. Bot players join and raise your guild glory.</p>
        </div>
        <div className="shrink-0 rounded-xl border border-amber-400/40 bg-amber-400/10 px-2.5 py-1.5 text-center" title="Your guild credits (1 credit = 1 group)">
          <p className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300"><Coins className="h-3 w-3" />Credits</p>
          <p className="text-lg font-extrabold leading-none text-white">{credits ?? "–"}</p>
        </div>
      </div>

      {maintenance && <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">Under maintenance. Please check back soon.</p>}

      {features.length > 0 && (
        <div className="mt-4 space-y-2">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-2.5 text-sm text-white/80"><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/20"><Check className="h-2.5 w-2.5 text-amber-300 stroke-[3]" /></span>{f}</div>
          ))}
          {product.features.length > 4 && (
            <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} aria-label={more ? "Show fewer features" : "Show more features"} className="mx-auto flex h-6 w-10 items-center justify-center rounded-full text-amber-300 hover:bg-white/[0.06] cursor-pointer">
              <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${more ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      )}

      <div className="mt-5 space-y-5">
        {/* 1. BUY TOKENS */}
        <section className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className={step}>Step 1 · Buy tokens</p>
          <div className="flex flex-wrap gap-2">
            {product.prices.map((p) => (
              <button key={p.duration} type="button" onClick={() => setDuration(p.duration)} className={`rounded-xl border px-3.5 py-2 text-sm font-semibold cursor-pointer ${p.duration === duration ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-slate-700 text-slate-300"}`}>{p.duration} · ₹{priceOf(p)}</button>
            ))}
          </div>
          <p className="flex items-center gap-2 text-xs text-slate-400"><Wallet className="h-4 w-4" />Paid from wallet balance{balance !== null ? ` (₹${balance.toFixed(2)})` : ""}</p>
          {note("buy")}
          <button onClick={buy} disabled={buying || maintenance || !tier} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#ffb800] text-base font-extrabold text-[#1a1305] hover:opacity-90 disabled:opacity-60 cursor-pointer">
            {buying ? <Loader2 className="h-5 w-5 animate-spin" /> : <Gift className="h-5 w-5" />}{buying ? "Creating token..." : `Buy ${tier?.duration ?? "token"}  →  ₹${priceOf(tier)}`}
          </button>
          {bought && (
            <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="flex items-center gap-2 text-sm font-bold text-emerald-300"><CheckCircle2 className="h-4 w-4" />Token ready ({bought.credits} credit{bought.credits === 1 ? "" : "s"}). Copy it and keep it safe.</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 select-all break-all rounded-lg bg-black/40 px-3 py-2 text-sm font-bold text-white">{bought.code}</code>
                <button type="button" onClick={copyCode} className="flex h-10 items-center gap-1.5 rounded-lg bg-slate-800 px-3 text-xs font-semibold text-white cursor-pointer">{copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy"}</button>
              </div>
              <button type="button" onClick={() => setRedeemCode(bought.code)} className="text-xs font-semibold text-amber-300 underline cursor-pointer">Paste it in the redeem box below</button>
            </div>
          )}
        </section>

        {/* 2. REDEEM */}
        <section className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className={step}>Step 2 · Redeem token</p>
          <div className="flex gap-2">
            <input value={redeemCode} onChange={(e) => setRedeemCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40))} placeholder="GG-XXXX-XXXX-XXXX-XXXX" className={`${field} min-w-0 flex-1 !py-3 text-sm`} />
            <button onClick={redeem} disabled={redeeming} className="flex min-h-12 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-slate-800 px-4 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-60 cursor-pointer">{redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}Redeem</button>
          </div>
          {note("redeem")}
        </section>

        {/* 3. LAUNCH */}
        <section className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className={step}>Step 3 · Launch group</p>
          {!connected && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">Service is being connected. Please check back soon.</p>}
          <label className="block">
            <span className={label}><Globe className="h-5 w-5 text-amber-200/80" />Account region</span>
            <select value={region} onChange={(e) => setRegion(e.target.value)} className={`${field} appearance-none cursor-pointer`}>
              <option value="">{regions.length ? "Choose a region" : "No region available now"}</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}{r.code ? ` (${r.code})` : ""}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={label}><Users className="h-5 w-5 text-amber-200/80" />Guild / Clan ID</span>
            <input value={guildId} onChange={(e) => setGuildId(e.target.value.replace(/\D/g, "").slice(0, 20))} inputMode="numeric" placeholder="e.g. 123456789" className={field} />
          </label>
          {note("launch")}
          {launching && (
            <div className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3" role="status" aria-live="polite">
              {LAUNCH_STEPS.map((t, i) => (
                <div key={t} className={`flex items-center gap-2.5 text-sm transition-opacity duration-500 ${i <= stage ? "opacity-100" : "opacity-30"}`}>
                  {i < stage ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : i === stage ? <Loader2 className="h-4 w-4 animate-spin text-amber-300" /> : <span className="h-4 w-4 rounded-full border border-slate-600" />}
                  <span className={i === stage ? "font-bold text-amber-200" : "text-slate-300"}>{t}</span>
                </div>
              ))}
              <div className="h-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-1/3 animate-pulse rounded-full bg-amber-400" style={{ marginLeft: `${Math.min(stage, 3) * 22}%`, transition: "margin 700ms" }} /></div>
            </div>
          )}
          <button onClick={launch} disabled={launching || maintenance} className="flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-[#ffb800] text-base font-extrabold text-[#1a1305] shadow-[0_8px_30px_-8px_rgba(255,184,0,0.6)] hover:opacity-90 disabled:opacity-60 cursor-pointer">
            {launching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}{launching ? "Launching…" : "Launch Group  →  1 credit"}
          </button>
          <p className="text-center text-[11px] text-slate-500">If the bot cannot be started, your credit is returned automatically.</p>
        </section>

        {groups.length > 0 && (
          <section className="space-y-3">
            <p className={step}>Your groups</p>
            {groups.slice(0, 3).map((g) => <GroupPanel key={g.ref + g.at} g={g} onRemoved={loadMe} />)}
          </section>
        )}
      </div>
    </div>
  );
}
