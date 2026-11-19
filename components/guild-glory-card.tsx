"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Copy, Crown, Flame, Globe, History, Loader2, Power, RefreshCw, Rocket, Square, Ticket, Trash2, Undo2, Users, Wallet, Zap } from "lucide-react";
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

/** Progress ring (SVG, no animation cost). */
function Ring({ pct, children }: { pct: number | null; children: React.ReactNode }) {
  const r = 34, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div className="relative grid h-[88px] w-[88px] shrink-0 place-items-center">
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="6" className="stroke-white/10" />
        {pct != null && <circle cx="40" cy="40" r={r} fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-fuchsia-400 transition-all duration-700" strokeDasharray={c} strokeDashoffset={c - (c * p) / 100} />}
      </svg>
      <div className="relative text-center leading-tight">{children}</div>
    </div>
  );
}

/** One guild, shown as a compact "control deck": big glory number + goal ring, four mini stats, icon actions. */
function GuildDeck({ g, onRemoved }: { g: Group; onRemoved: () => void }) {
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

  const status = g.refunded ? "refunded" : g.ended ? "ended" : v?.status ?? g.status ?? "starting";
  const live = !g.ended && !g.refunded && isRunning(status);
  const name = v?.name || g.name || `Guild ${g.clan}`;
  const off = !!busy || g.refunded || g.ended;
  const icon = "group flex min-w-0 flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-1 py-2.5 text-[10px] font-semibold text-white/80 transition hover:border-violet-400/60 hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer";

  return (
    <article className="overflow-hidden rounded-3xl border border-violet-400/25 bg-gradient-to-b from-violet-500/[0.10] to-transparent">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${live ? "bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,.6)]" : g.ended || g.refunded ? "bg-rose-400" : "bg-amber-400"}`} />
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-base font-extrabold text-white">{name}</h4>
          <p className="truncate text-[11px] text-white/50">#{g.clan} · {g.regionName} · {status}{v?.level != null ? ` · Lv ${v.level}` : ""}</p>
        </div>
      </header>

      {g.ended ? (
        <p className="m-4 rounded-xl border border-rose-500/25 bg-rose-500/5 px-3 py-2.5 text-xs text-rose-300">This group is no longer active on the service. If you were charged and it never started, ask for a refund below.</p>
      ) : (
        <div className="space-y-4 p-4">
          <div className="flex items-center gap-4">
            <Ring pct={v?.goalPercent ?? null}><b className="block text-lg text-white">{v?.goalPercent != null ? `${Math.round(v.goalPercent)}%` : "–"}</b><span className="block text-[9px] uppercase tracking-wider text-white/50">8h goal</span></Ring>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-300"><Crown className="h-3.5 w-3.5" />Total glory</p>
              <p className="text-3xl font-black leading-tight text-white tabular-nums">{fmt(v?.totalGlory ?? null)}</p>
              <p className="text-[11px] text-white/50">Weekly {fmt(v?.weeklyGlory ?? v?.groupGlory ?? null)}</p>
            </div>
          </div>
          <dl className="grid grid-cols-4 gap-2 text-center">
            {[
              ["Members", v?.members != null ? `${v.members}${v.maxMembers != null ? `/${v.maxMembers}` : ""}` : "–"],
              ["Bots", v?.bots ?? "–"],
              ["Uptime", v?.uptime ?? "–"],
              ["Captain", v?.captain ?? "–"],
            ].map(([k, val]) => (
              <div key={String(k)} className="min-w-0 rounded-xl bg-white/[0.05] px-1 py-2"><dd className="truncate text-sm font-extrabold text-white">{String(val)}</dd><dt className="text-[9px] uppercase tracking-wider text-white/45">{k}</dt></div>
            ))}
          </dl>
          {v?.lastMatch && <p className="text-[11px] text-white/45">Last match: {niceVal(v.lastMatch)}</p>}
          {err && !v && <p className="text-xs text-white/50">{err}</p>}
        </div>
      )}

      <div className="space-y-3 border-t border-white/10 p-4 pt-3">
        {note && <p className="text-xs text-fuchsia-300">{note}</p>}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <button onClick={() => act("restart")} disabled={off} className={icon} aria-label="Restart">{busy === "restart" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}Restart</button>
          <button onClick={() => act("stop")} disabled={off} className={icon} aria-label="Stop">{busy === "stop" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}Stop</button>
          <button onClick={() => act("refresh")} disabled={!!busy || g.ended} className={icon} aria-label="Refresh">{busy === "refresh" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Refresh</button>
          <button onClick={() => show("history")} disabled={g.ended} className={icon} aria-label="Match history"><History className="h-4 w-4" />Matches</button>
          <button onClick={() => show("players")} disabled={g.ended} className={icon} aria-label="Players"><Users className="h-4 w-4" />Players</button>
          <button onClick={copyId} className={icon} aria-label="Copy group ID">{copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy ID"}</button>
        </div>
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <button onClick={() => act("refund")} disabled={!!busy || refundAsked} className="inline-flex items-center gap-1.5 text-white/60 underline-offset-2 hover:text-white hover:underline disabled:opacity-40 cursor-pointer">{busy === "refund" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}{refundAsked ? "Refund requested" : "Request refund"}</button>
          <button onClick={() => act("delete")} disabled={!!busy || g.ended} className="inline-flex items-center gap-1.5 text-rose-300/80 underline-offset-2 hover:text-rose-300 hover:underline disabled:opacity-40 cursor-pointer">{busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}Remove group</button>
        </div>
        {list && (
          <div className="max-h-60 space-y-1.5 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-300">{list.kind === "history" ? "Match history" : "Players"}</p>
            {list.rows === null ? <p className="flex items-center gap-2 text-xs text-white/50"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading…</p>
              : list.error ? <p className="text-xs text-rose-300">{list.error}</p>
              : list.rows.length === 0 ? <p className="text-xs text-white/50">Nothing to show yet.</p>
              : list.rows.map((r, i) => (
                <div key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs">
                  {Object.entries(r).map(([k, val2]) => <span key={k} className="text-white/80"><span className="text-white/45">{nice(k)}:</span> {niceVal(val2)}</span>)}
                </div>
              ))}
          </div>
        )}
      </div>
    </article>
  );
}

const LAUNCH_STEPS = ["Checking your region", "Guild found", "Adding bot players to your guild", "Almost ready to launch"];
type Tab = "tokens" | "launch" | "guilds";

/**
 * Guild Glory "Vault": three tabs inside ONE card.
 *   Tokens  - pick a pack, pay from the wallet, get a token ticket, redeem it (credits sit in the header)
 *   Launch  - region chips + Guild ID, animated progress timeline
 *   Guilds  - your live guild decks
 * Colours come from the store theme (violet/fuchsia scale), so it matches every design. Everything is validated again on the server.
 */
export function GuildGloryCard({ product }: { product: Product }) {
  const [tab, setTab] = useState<Tab>("tokens");
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
  const features = more ? product.features : product.features.slice(0, 3);
  const say = (where: "buy" | "redeem" | "launch", kind: "ok" | "err", text: string) => setMsg({ where, kind, text });
  const shareBalance = (b: unknown) => { const n = Number(b); if (Number.isFinite(n)) { setBalance(n); window.dispatchEvent(new CustomEvent(WALLET_BALANCE_EVENT, { detail: { balance: n } })); } };
  const field = "w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-base font-semibold text-white outline-none placeholder:text-white/30 focus:border-violet-400";

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
      if (ok) { setCredits(Number(j.credits) || 0); setRedeemCode(""); if (bought && bought.code === code.toUpperCase()) setBought(null); say("redeem", "ok", `+${j.added} credit${j.added === 1 ? "" : "s"} added. Open the Launch tab.`); }
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
      if (ok) { setCredits(Number(j.credits) || 0); say("launch", "ok", `${j.message} Order ID: ${j.ref}`); setGuildId(""); await loadMe(); setTab("guilds"); }
      else { if (Number.isFinite(Number(j.credits))) setCredits(Number(j.credits)); say("launch", "err", j.error || "Could not start the bot."); }
    } catch { say("launch", "err", "Network problem. Please try again."); }
    clearInterval(timer);
    setLaunching(false);
  }

  const note = (where: "buy" | "redeem" | "launch") =>
    msg && msg.where === where ? (
      <p className={`rounded-xl border px-3 py-2 text-sm ${msg.kind === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>{msg.text}</p>
    ) : null;
  const tabs: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: "tokens", label: "Tokens", icon: Ticket },
    { id: "launch", label: "Launch", icon: Rocket },
    { id: "guilds", label: "Guilds", icon: Crown, badge: groups.length || undefined },
  ];

  return (
    <div data-store-card className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.04] backdrop-blur-sm">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-500/25 blur-3xl" aria-hidden />

      {/* header: title + credit balance as a pill */}
      <div className="relative flex items-start gap-3 p-5 pb-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30"><Flame className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-extrabold leading-tight text-white">{product.name}</h3>
          <p className="mt-0.5 text-xs text-white/55">Bots join your guild and push its glory up.</p>
        </div>
        <span title="Guild credits (1 credit = 1 group)" className="flex shrink-0 items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-sm font-extrabold text-white"><Zap className="h-3.5 w-3.5 text-fuchsia-300" />{credits ?? "–"}</span>
      </div>

      {maintenance && <p className="mx-5 mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">Under maintenance. Please check back soon.</p>}

      {features.length > 0 && (
        <div className="px-5 pb-3">
          <ul className="space-y-1.5">
            {features.map((f, i) => (<li key={i} className="flex items-start gap-2 text-[13px] text-white/75"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fuchsia-300" />{f}</li>))}
          </ul>
          {product.features.length > 3 && (
            <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} aria-label={more ? "Show fewer features" : "Show more features"} className="mx-auto mt-1 flex h-6 w-10 items-center justify-center rounded-full text-white/60 hover:bg-white/10 cursor-pointer"><ChevronDown className={`h-4 w-4 transition-transform duration-300 ${more ? "rotate-180" : ""}`} /></button>
          )}
        </div>
      )}

      {/* tab switcher */}
      <div role="tablist" className="relative mx-5 grid grid-cols-3 gap-1 rounded-2xl bg-black/25 p-1">
        {tabs.map((t) => { const I = t.icon; const on = tab === t.id; return (
          <button key={t.id} role="tab" aria-selected={on} onClick={() => setTab(t.id)} className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition cursor-pointer ${on ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow" : "text-white/60 hover:text-white"}`}>
            <I className="h-3.5 w-3.5" /><span className="truncate">{t.label}</span>{t.badge ? <span className="rounded-full bg-white/25 px-1.5 text-[10px]">{t.badge}</span> : null}
          </button>); })}
      </div>

      <div className="relative space-y-4 p-5">
        {tab === "tokens" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {product.prices.map((p) => { const on = p.duration === duration; return (
                <button key={p.duration} type="button" onClick={() => setDuration(p.duration)} className={`rounded-2xl border p-3 text-left transition cursor-pointer ${on ? "border-violet-400 bg-violet-500/20 ring-1 ring-violet-400/60" : "border-white/12 bg-white/[0.03] hover:border-white/30"}`}>
                  <span className="block text-sm font-extrabold text-white">{p.duration}</span>
                  <span className="block text-lg font-black text-fuchsia-300">₹{priceOf(p)}</span>
                </button>); })}
            </div>
            <p className="flex items-center gap-2 text-xs text-white/55"><Wallet className="h-4 w-4" />Paid from your wallet{balance !== null ? ` · ₹${balance.toFixed(2)} available` : ""}</p>
            {note("buy")}
            <button onClick={buy} disabled={buying || maintenance || !tier} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-sm font-extrabold text-white shadow-lg shadow-violet-600/30 hover:brightness-110 disabled:opacity-60 cursor-pointer">
              {buying ? <Loader2 className="h-5 w-5 animate-spin" /> : <Ticket className="h-5 w-5" />}{buying ? "Printing your token…" : `Get ${tier?.duration ?? "token"} for ₹${priceOf(tier)}`}
            </button>

            {bought && (
              <div className="relative rounded-2xl border border-dashed border-fuchsia-400/60 bg-fuchsia-500/[0.07] p-4">
                <span className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-black/60" aria-hidden /><span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-black/60" aria-hidden />
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-fuchsia-300">Your token · {bought.credits} credit{bought.credits === 1 ? "" : "s"}</p>
                <code className="mt-1 block select-all break-all text-base font-black tracking-wider text-white">{bought.code}</code>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={copyCode} className="flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/20 cursor-pointer">{copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy"}</button>
                  <button type="button" onClick={() => setRedeemCode(bought.code)} className="h-9 rounded-lg border border-white/20 px-3 text-xs font-bold text-white/80 hover:bg-white/10 cursor-pointer">Use it below</button>
                </div>
              </div>
            )}

            <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">Have a token? Redeem it</p>
              <div className="flex gap-2">
                <input value={redeemCode} onChange={(e) => setRedeemCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40))} placeholder="GG-XXXX-XXXX-XXXX-XXXX" className={`${field} min-w-0 flex-1 !py-2.5 text-sm`} />
                <button onClick={redeem} disabled={redeeming} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-4 text-sm font-bold text-white hover:bg-white/20 disabled:opacity-60 cursor-pointer">{redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}Redeem</button>
              </div>
              {note("redeem")}
            </div>
          </>
        )}

        {tab === "launch" && (
          <>
            {!connected && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">Service is being connected. Please check back soon.</p>}
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-bold text-white"><Globe className="h-4 w-4 text-fuchsia-300" />Account region</p>
              {regions.length === 0 ? <p className="text-xs text-white/50">No region available right now.</p> : (
                <div className="flex flex-wrap gap-2">
                  {regions.map((r) => (<button key={r.id} type="button" onClick={() => setRegion(r.id)} className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${region === r.id ? "border-transparent bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white" : "border-white/20 text-white/75 hover:border-white/50"}`}>{r.name}{r.code ? ` · ${r.code}` : ""}</button>))}
                </div>
              )}
            </div>
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-bold text-white"><Users className="h-4 w-4 text-fuchsia-300" />Guild / Clan ID</span>
              <input value={guildId} onChange={(e) => setGuildId(e.target.value.replace(/\D/g, "").slice(0, 20))} inputMode="numeric" placeholder="e.g. 123456789" className={field} />
            </label>
            {note("launch")}
            {launching ? (
              <ol className="space-y-0 rounded-2xl border border-violet-400/30 bg-violet-500/10 p-4" role="status" aria-live="polite">
                {LAUNCH_STEPS.map((t, i) => (
                  <li key={t} className={`relative flex items-center gap-3 pb-3 pl-0 text-sm last:pb-0 transition-opacity duration-500 ${i <= stage ? "opacity-100" : "opacity-35"}`}>
                    {i < LAUNCH_STEPS.length - 1 && <span className={`absolute left-[9px] top-5 h-full w-px ${i < stage ? "bg-fuchsia-400" : "bg-white/15"}`} aria-hidden />}
                    <span className="relative grid h-5 w-5 shrink-0 place-items-center rounded-full border border-fuchsia-400/60 bg-black/40">{i < stage ? <Check className="h-3 w-3 text-emerald-300" /> : i === stage ? <Loader2 className="h-3 w-3 animate-spin text-fuchsia-300" /> : null}</span>
                    <span className={i === stage ? "font-bold text-white" : "text-white/70"}>{t}{i === stage ? "…" : ""}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <button onClick={launch} disabled={maintenance} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-sm font-extrabold text-white shadow-lg shadow-violet-600/30 hover:brightness-110 disabled:opacity-60 cursor-pointer"><Rocket className="h-5 w-5" />Start bots · uses 1 credit</button>
            )}
            <p className="text-center text-[11px] text-white/45">If the bots cannot start, your credit comes back automatically.</p>
          </>
        )}

        {tab === "guilds" && (
          groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/20 p-6 text-center">
              <Crown className="mx-auto mb-2 h-7 w-7 text-white/40" />
              <p className="text-sm font-bold text-white">No guilds yet</p>
              <p className="mt-1 text-xs text-white/55">Start your first group from the Launch tab.</p>
              <button onClick={() => setTab("launch")} className="mt-3 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold text-white hover:bg-white/20 cursor-pointer">Go to Launch</button>
            </div>
          ) : (
            <div className="space-y-3">{groups.slice(0, 3).map((g) => <GuildDeck key={g.ref + g.at} g={g} onRemoved={loadMe} />)}</div>
          )
        )}
      </div>
    </div>
  );
}
