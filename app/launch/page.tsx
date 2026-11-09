"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Copy, Loader2, Rocket } from "lucide-react";
import { useBrand } from "@/components/brand-provider";

type Plan = { label: string; price: number; days: number; note: string };
type Options = { selfService: boolean; root: string | null; customDomain: boolean; trialDays: number; plans: Record<string, Plan> } | null;
type Done = { url: string; expiresAt: string; custom: any } | null;
const field = "w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-fuchsia-400/60";
const label = "block text-xs font-medium text-white/60 mb-1.5";
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex flex-wrap gap-x-3 text-xs"><span className="w-14 text-white/40">{k}</span><code className="font-mono text-white break-all select-all">{v}</code></div>
);

export default function LaunchPage() {
  const brand = useBrand();
  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const [opts, setOpts] = useState<Options>(null);
  const [existing, setExisting] = useState<{ brandName: string; slug: string; status: string } | null>(null);
  const [done, setDone] = useState<Done>(null);
  const [choice, setChoice] = useState<"free" | "custom">("free");
  const [f, setF] = useState({ brandName: "", slug: "", customDomain: "", telegramUsername: "", contactPhone: "", contactEmail: "", coadminUsername: "", coadminPassword: "" });
  const [slugMsg, setSlugMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/tenant/apply", { cache: "no-store" });
        if (res.status === 401) { window.location.href = "/login"; return; }
        const j = await res.json();
        if (!j.eligible) { setState("denied"); return; }
        setOpts(j.options ?? null); setExisting(j.application && j.application.status !== "rejected" ? j.application : null); setState("ready");
      } catch { setState("denied"); }
    })();
  }, []);

  function onSlug(v: string) {
    const slug = v.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32);
    setF((p) => ({ ...p, slug })); setSlugMsg(null);
    window.clearTimeout(timer.current);
    if (slug.length < 3) return;
    timer.current = window.setTimeout(async () => {
      try {
        const r = await fetch(`/api/tenant/slug-check?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
        const j = await r.json();
        setSlugMsg(j.available ? { ok: true, text: "This name is free" } : { ok: false, text: j.reason || j.error || "Not available" });
      } catch { /* ignore */ }
    }, 400);
  }

  async function submit() {
    setBusy(true); setErr("");
    try {
      const body = { ...f, domainChoice: choice, customDomain: choice === "custom" ? f.customDomain : "" };
      const r = await fetch("/api/tenant/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok || !j.success) setErr(j.error || "Could not launch. Please try again.");
      else if (j.launched) setDone({ url: j.url, expiresAt: j.expiresAt, custom: j.custom });
      else setExisting({ brandName: f.brandName, slug: f.slug, status: "pending" });
    } catch { setErr("Network error. Try again."); }
    setBusy(false);
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const root = opts?.root || "yourdomain.com";
  const trial = opts?.trialDays ?? 3;

  return (
    <main className="min-h-screen bg-[#07040f] text-zinc-100 px-4 py-8">
      <div className="mx-auto w-full max-w-xl">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white mb-6"><ArrowLeft className="h-3.5 w-3.5" />Back to {brand.name}</Link>
        <div className="rounded-2xl border border-violet-500/20 bg-[#0b0714] p-5 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600"><Rocket className="h-5 w-5 text-white" /></span>
            <div>
              <h1 className="text-xl font-bold text-white">Launch Your Own Website</h1>
              <p className="text-xs text-white/50">Fill the form. Your website is ready in 1 minute.</p>
            </div>
          </div>

          {state === "loading" && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-white/50" /></div>}
          {state === "denied" && <p className="text-sm text-white/60">This option is only for reseller accounts.</p>}

          {state === "ready" && done && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200 flex gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold">Your website is live!</p>
                  <a href={done.url} className="mt-1 block break-all font-mono text-emerald-100 underline">{done.url}</a>
                  <button onClick={() => { navigator.clipboard?.writeText(done.url); setCopied(true); }} className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-300"><Copy className="h-3.5 w-3.5" />{copied ? "Copied" : "Copy link"}</button>
                </div>
              </div>
              <ol className="list-decimal pl-5 space-y-1.5 text-sm text-white/70">
                <li>Open your link and log in with the admin username and password you just chose.</li>
                <li>Go to <b>Admin</b>: add your products, set your colors in <b>Branding</b>.</li>
                <li>Your free trial ends on <b>{new Date(done.expiresAt).toLocaleDateString()}</b>. Pay from <b>Admin &gt; Subscription</b>.</li>
              </ol>
              {done.custom && !done.custom.error && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                  <p className="text-sm font-semibold text-white">Your own domain: 2 more steps</p>
                  <p className="text-xs text-white/60">At the company where you bought <b>{done.custom.host}</b>, open DNS settings and add these two records:</p>
                  <Row k="TXT" v={`name: ${done.custom.txtName}`} /><Row k="" v={`value: ${done.custom.txtValue}`} />
                  <Row k="CNAME" v={`name: ${done.custom.host.split(".")[0]}   value: ${done.custom.cname}`} />
                  <p className="text-xs text-white/60">Wait 5 to 30 minutes, then in your store go to <b>Admin &gt; Domain</b> and press <b>Check DNS</b>. Until then, use your free link above.</p>
                </div>
              )}
              {done.custom?.error && <p className="text-xs text-amber-300">Your own domain could not be added: {done.custom.error}. You can try again in Admin &gt; Domain. Your free link works.</p>}
            </div>
          )}

          {state === "ready" && !done && existing && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200 flex gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">{existing.status === "approved" ? "You already have a website" : "Application received"}</p>
                <p className="mt-1 text-emerald-200/80">{existing.brandName} {opts?.root ? `(${existing.slug}.${opts.root})` : ""}. Each reseller can have one website.</p>
              </div>
            </div>
          )}

          {state === "ready" && !done && !existing && (
            <div className="space-y-4">
              <div>
                <label className={label}>1. Your store name</label>
                <input className={field} placeholder="Example: Raj Gaming Store" value={f.brandName} maxLength={40} onChange={set("brandName")} />
              </div>

              <div>
                <label className={label}>2. Choose your website address</label>
                <div className="grid sm:grid-cols-2 gap-2">
                  <button type="button" onClick={() => setChoice("free")} className={`text-left rounded-xl border p-3 cursor-pointer ${choice === "free" ? "border-fuchsia-400/70 bg-fuchsia-500/10" : "border-white/10 bg-white/[0.03]"}`}>
                    <p className="text-sm font-semibold text-white">Free address</p>
                    <p className="text-xs text-white/50">No cost. Example:</p>
                    <p className="text-xs font-mono text-fuchsia-300 break-all">rajstore.{root}</p>
                  </button>
                  <button type="button" disabled={!opts?.customDomain} onClick={() => setChoice("custom")} className={`text-left rounded-xl border p-3 cursor-pointer disabled:opacity-40 ${choice === "custom" ? "border-fuchsia-400/70 bg-fuchsia-500/10" : "border-white/10 bg-white/[0.03]"}`}>
                    <p className="text-sm font-semibold text-white">My own domain</p>
                    <p className="text-xs text-white/50">You buy the domain. Example:</p>
                    <p className="text-xs font-mono text-fuchsia-300 break-all">shop.rajstore.com</p>
                  </button>
                </div>
              </div>

              <div>
                <label className={label}>{choice === "free" ? "Pick the name for your free address (small letters and numbers)" : "Free address name (your backup link, small letters and numbers)"}</label>
                <div className="flex items-center gap-2">
                  <input className={field} placeholder="rajstore" value={f.slug} onChange={(e) => onSlug(e.target.value)} />
                  <span className="text-xs text-white/40 whitespace-nowrap">.{root}</span>
                </div>
                {slugMsg && <p className={`mt-1 text-xs ${slugMsg.ok ? "text-emerald-400" : "text-rose-400"}`}>{slugMsg.text}</p>}
              </div>

              {choice === "custom" && (
                <div>
                  <label className={label}>Your own domain (we show you what to do after you press Launch)</label>
                  <input className={field} placeholder="shop.rajstore.com" value={f.customDomain} onChange={set("customDomain")} />
                  <p className="mt-1 text-[11px] text-white/40">Type only the name, no https:// and no slash.</p>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className={label}>3. Your Telegram username</label><input className={field} placeholder="@yourname" value={f.telegramUsername} onChange={set("telegramUsername")} /></div>
                <div><label className={label}>Phone number</label><input className={field} inputMode="tel" placeholder="9876543210" value={f.contactPhone} onChange={set("contactPhone")} /></div>
              </div>
              <div><label className={label}>Email (optional)</label><input className={field} type="email" placeholder="you@gmail.com" value={f.contactEmail} onChange={set("contactEmail")} /></div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className={label}>4. Admin username for your store</label><input className={field} autoComplete="off" value={f.coadminUsername} onChange={set("coadminUsername")} /></div>
                <div><label className={label}>Admin password (8+ letters)</label><input className={field} type="password" autoComplete="new-password" value={f.coadminPassword} onChange={set("coadminPassword")} /></div>
              </div>

              {opts?.plans && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-white">Price</p>
                  <p className="text-xs text-emerald-300 mt-1">First {trial} days are FREE. No payment needed now.</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    {Object.entries(opts.plans).map(([k, p]) => (
                      <div key={k} className="rounded-lg border border-white/10 px-2 py-2">
                        <p className="text-[11px] text-white/50">{p.label}</p>
                        <p className="text-sm font-bold text-white">₹{p.price}</p>
                        <p className="text-[10px] text-white/40">{p.days} days{p.note ? ` · ${p.note}` : ""}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-white/40">After the free days, you pay from your wallet balance on this website. One reseller can have one store.</p>
                </div>
              )}

              {err && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{err}</p>}
              {opts && !opts.selfService && <p className="text-xs text-amber-300">Instant launch is not open yet. Your form will be sent to the owner for approval.</p>}
              <button onClick={submit} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-bold text-white disabled:opacity-50 cursor-pointer">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}Launch my website
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
