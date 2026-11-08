"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Rocket } from "lucide-react";
import { useBrand } from "@/components/brand-provider";

type App = { brandName: string; slug: string; status: string; note: string } | null;
const field = "w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-fuchsia-400/60";

export default function LaunchPage() {
  const brand = useBrand();
  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const [app, setApp] = useState<App>(null);
  const [f, setF] = useState({ brandName: "", slug: "", telegramUsername: "", inventoryMode: "own_api", contactPhone: "", contactEmail: "", coadminUsername: "", coadminPassword: "" });
  const [slugMsg, setSlugMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/tenant/apply", { cache: "no-store" });
        if (res.status === 401) { window.location.href = "/login"; return; }
        const j = await res.json();
        if (!j.eligible) { setState("denied"); return; }
        setApp(j.application); setState("ready");
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
        setSlugMsg(j.available ? { ok: true, text: "Available" } : { ok: false, text: j.reason || j.error || "Not available" });
      } catch { /* ignore */ }
    }, 400);
  }

  async function submit() {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/tenant/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json();
      if (!r.ok || !j.success) { setErr(j.error || "Could not submit."); }
      else { setApp({ brandName: f.brandName, slug: f.slug, status: "pending", note: "" }); }
    } catch { setErr("Network error. Try again."); }
    setBusy(false);
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <main className="min-h-screen bg-[#07040f] text-zinc-100 px-4 py-8">
      <div className="mx-auto w-full max-w-xl">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white mb-6"><ArrowLeft className="h-3.5 w-3.5" />Back to {brand.name}</Link>
        <div className="rounded-2xl border border-violet-500/20 bg-[#0b0714] p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600"><Rocket className="h-5 w-5 text-white" /></span>
            <div>
              <h1 className="text-xl font-bold text-white">Launch Your Own Website</h1>
              <p className="text-xs text-white/50">Get your own store with its own customers, products and look.</p>
            </div>
          </div>

          {state === "loading" && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-white/50" /></div>}
          {state === "denied" && <p className="text-sm text-white/60">This option is only available to reseller accounts.</p>}

          {state === "ready" && app && app.status !== "rejected" && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200 flex gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">{app.status === "approved" ? "Your store is approved" : "Application received"}</p>
                <p className="text-xs mt-1 text-emerald-200/80">
                  {app.status === "approved"
                    ? <>“{app.brandName}” is created. Sign in on your new store with the admin username and password you chose.</>
                    : <>“{app.brandName}” is waiting for approval. You will be able to sign in on your store with the admin username and password you chose once it is approved.</>}
                </p>
              </div>
            </div>
          )}

          {state === "ready" && (!app || app.status === "rejected") && (
            <div className="space-y-3">
              {app?.status === "rejected" && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">Your last application was not approved{app.note ? `: ${app.note}` : "."} You can apply again.</p>}
              <input className={field} placeholder="Your website brand name" maxLength={40} value={f.brandName} onChange={set("brandName")} />
              <div>
                <input className={field} placeholder="Your web address name (e.g. andrews)" value={f.slug} onChange={(e) => onSlug(e.target.value)} />
                <p className={`mt-1 text-[11px] ${slugMsg ? (slugMsg.ok ? "text-emerald-400" : "text-rose-400") : "text-white/40"}`}>
                  {slugMsg ? slugMsg.text : "Letters, numbers and single hyphens. Your free address is based on this name."}
                </p>
              </div>
              <input className={field} placeholder="Your Telegram username" value={f.telegramUsername} onChange={set("telegramUsername")} />
              <select className={field} value={f.inventoryMode} onChange={set("inventoryMode")}>
                <option value="own_api" className="text-black">I use my own seller API / my own stock</option>
                <option value="shared_stock" className="text-black">I want to use the platform's shared stock</option>
              </select>
              <input className={field} placeholder="Phone number" inputMode="tel" value={f.contactPhone} onChange={set("contactPhone")} />
              <input className={field} placeholder="Email (optional)" value={f.contactEmail} onChange={set("contactEmail")} />
              <div className="pt-2 border-t border-white/10 space-y-3">
                <p className="text-[11px] uppercase tracking-wider text-white/40">Your store admin login</p>
                <input className={field} placeholder="Admin username" autoComplete="off" value={f.coadminUsername} onChange={set("coadminUsername")} />
                <input className={field} type="password" placeholder="Admin password (min 8 characters)" autoComplete="new-password" value={f.coadminPassword} onChange={set("coadminPassword")} />
              </div>
              {err && <p className="text-xs text-rose-400">{err}</p>}
              <button onClick={submit} disabled={busy} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}Submit application
              </button>
              <p className="text-[11px] text-white/40">Nothing goes live until the platform owner approves. Payment and supplier setup come after approval.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
