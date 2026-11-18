"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import StoreOptionsCard from "@/components/admin/StoreOptionsCard";
import LivePreview from "@/components/admin/LivePreview";
import ImageUploader from "@/components/admin/ImageUploader";

type Theme = {
  preset?: string; primary: string; accent: string; background: string; surface: string; foreground: string;
  font: string; logoUrl: string; tagline: string; announcement: string; footerText: string;
  radius: string; cardStyle: string; backdrop: string; backdropImageUrl: string; heroLayout: string; heroTitle: string;
  heroSubtitle: string; heroImageUrl: string; loginCharacterUrl: string; loginPetUrl: string; loginCard: string; loginBg: string; ctaText: string; columns: number; fontScale: string; buttonStyle: string;
  showStats: boolean; motion: boolean;
  cardHover: string; whatsapp: string; instagram: string; youtube: string; floatingChat: boolean;
};
const CHOICES: { key: keyof Theme; label: string; options: [string | number, string][] }[] = [
  { key: "heroLayout", label: "Top banner layout", options: [["centered", "Centered"], ["left", "Left aligned"], ["split", "Text + picture"]] },
  { key: "cardStyle", label: "Product cards", options: [["glass", "Glass"], ["solid", "Solid"], ["outline", "Outline"], ["elevated", "Shadow"]] },
  { key: "radius", label: "Corners", options: [["sharp", "Square"], ["soft", "Slightly round"], ["round", "Round"], ["pill", "Very round"]] },
  { key: "columns", label: "Products per row (large screens)", options: [[2, "2"], [3, "3"], [4, "4"]] },
  { key: "backdrop", label: "Page background", options: [["solid", "Plain"], ["gradient", "Gradient"], ["aurora", "Glow"], ["grid", "Grid lines"], ["image", "Picture"]] },
  { key: "loginCard", label: "Login page card design", options: [["original", "Original"], ["glass", "Glass Glow"], ["frost", "Frost Light"], ["neon", "Neon Outline"], ["minimal", "Clean Minimal"], ["aurora", "Aurora Border"]] },
  { key: "loginBg", label: "Login page background animation", options: [["original", "Original"], ["aurora", "Aurora Glow"], ["particles", "Particle Network"], ["beams", "Grid Beams"], ["waves", "Silk Waves"], ["stars", "Star Warp"]] },
  { key: "cardHover", label: "When a visitor touches a product card", options: [["none", "Nothing"], ["lift", "Lifts up"], ["glow", "Glows"]] },
  { key: "buttonStyle", label: "Buttons", options: [["gradient", "Two-color gradient"], ["solid", "Single color"]] },
  { key: "fontScale", label: "Text size", options: [["small", "Small"], ["normal", "Normal"], ["large", "Large"]] },
];
const field = "mt-1 w-full min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-white outline-none focus:border-indigo-500";

/** Collapsible section so a phone screen shows one topic at a time. */
function Section({ title, hint, open, children }: { title: string; hint?: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group rounded-xl border border-slate-800 bg-slate-900/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-white">{title}</span>
          {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
        </span>
        <span className="shrink-0 text-slate-400 transition-transform group-open:rotate-180">&#9662;</span>
      </summary>
      <div className="space-y-3 border-t border-slate-800 p-3.5">{children}</div>
    </details>
  );
}

export default function BrandingManager() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [presets, setPresets] = useState<Record<string, Partial<Theme>>>({});
  const [fonts, setFonts] = useState<Record<string, string>>({});
  const [brandName, setBrandName] = useState("");
  const [telegram, setTelegram] = useState("");
  const [kind, setKind] = useState("coadmin");
  const [saving, setSaving] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [snap, setSnap] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/branding", { cache: "no-store" });
      const j = await res.json();
      if (j.success) { setTheme(j.theme); setPresets(j.presets); setFonts(j.fonts); setBrandName(j.brandName); setTelegram(j.telegram || ""); setKind(j.kind); setSnap(JSON.stringify([j.theme, j.brandName, j.telegram || ""])); }
    })();
  }, []);

  if (!theme) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  const set = (k: keyof Theme, v: string | number | boolean) => setTheme({ ...theme, [k]: v, ...(["primary", "accent", "background", "surface", "foreground"].includes(k) ? { preset: "custom" } : {}) });

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const body: any = { theme };
      if (kind === "coadmin") { body.brandName = brandName; body.telegram = telegram; }
      const res = await fetch("/api/admin/branding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.success) { setPreviewVersion((n) => n + 1); setSnap(JSON.stringify([theme, brandName, telegram])); }
      setMsg(j.success ? { ok: true, text: "Saved. Preview updated below." } : { ok: false, text: j.error || "Could not save." });
    } catch { setMsg({ ok: false, text: "Network error." }); }
    setSaving(false);
  }

  const dirty = snap !== "" && snap !== JSON.stringify([theme, brandName, telegram]);
  const undo = () => { try { const [t, b, g] = JSON.parse(snap); setTheme(t); setBrandName(b); setTelegram(g); setMsg(null); } catch {} };
  const swatch = (name: string, p: Partial<Theme>) => (
    <button key={name} onClick={() => setTheme({ ...theme, ...(p as Theme), preset: name })}
      className={`rounded-xl border p-2 text-left cursor-pointer ${theme.preset === name ? "border-indigo-400 ring-2 ring-indigo-500/40" : "border-slate-700 hover:border-slate-500"}`}>
      <span className="block h-12 rounded-lg p-1.5" style={{ background: p.background, border: `1px solid ${p.primary}55` }}>
        <span className="block h-2 w-8 rounded-full" style={{ background: p.primary }} />
        <span className="mt-1 block h-2 w-5 rounded-full" style={{ background: p.accent }} />
        <span className="mt-1 block h-1.5 w-10 rounded-full opacity-60" style={{ background: p.foreground }} />
      </span>
      <span className="mt-1 block text-center text-[11px] capitalize text-slate-300">{name}</span>
    </button>
  );
  const color = (k: keyof Theme, label: string) => (
    <label className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-xs text-slate-300">
      <span className="min-w-0">{label}</span>
      <span className="flex shrink-0 items-center gap-2">
        <input type="color" value={String(theme[k])} onChange={(e) => set(k, e.target.value)} className="h-9 w-11 bg-transparent cursor-pointer" />
        <input value={String(theme[k])} onChange={(e) => set(k, e.target.value)} className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 font-mono text-sm sm:text-[11px] text-white" maxLength={7} />
      </span>
    </label>
  );

  return (
    <div className="space-y-4 max-w-3xl w-full min-w-0 overflow-x-hidden">
      <div>
        <h2 className="text-lg font-bold text-white">Store branding</h2>
        <p className="text-xs text-slate-400">Colors, font, logo and text for your customers' website.</p>
      </div>
      {msg && <div className={`rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>{msg.text}</div>}

      <StoreOptionsCard />


      <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 space-y-5">
        <div>
          <h3 className="text-base font-bold text-white">Quick start: 3 easy steps</h3>
          <p className="text-[11px] text-slate-400">Do these three, press Save, and your website looks new. Everything else is optional (see "More options" below).</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-white"><span className="mr-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[11px]">1</span>Pick a look</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">{Object.entries(presets).map(([name, p]) => swatch(name, p))}</div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-white"><span className="mr-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[11px]">2</span>Your brand</p>
          {kind === "coadmin" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-400">Brand name<input className={field} value={brandName} maxLength={40} onChange={(e) => setBrandName(e.target.value)} /></label>
              <label className="text-xs text-slate-400">Telegram username<input className={field} value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="yourname" /></label>
            </div>
          )}
          <ImageUploader label="Logo" hint="Square picture, shows in the top bar and the browser tab." value={theme.logoUrl} onChange={(u) => set("logoUrl", u)} />
          <label className="text-xs text-slate-400 block">Tagline (one short line under your name)<input className={field} value={theme.tagline} maxLength={120} onChange={(e) => set("tagline", e.target.value)} placeholder="Fast delivery. Trusted by gamers." /></label>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-white"><span className="mr-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[11px]">3</span>Top banner words</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-400">Big title<input className={field} value={theme.heroTitle} maxLength={60} onChange={(e) => set("heroTitle", e.target.value)} placeholder={brandName || "Your store"} /></label>
            <label className="text-xs text-slate-400">Button text<input className={field} value={theme.ctaText} maxLength={24} onChange={(e) => set("ctaText", e.target.value)} placeholder="Browse products" /></label>
          </div>
          <label className="text-xs text-slate-400 block">Small text under the title<input className={field} value={theme.heroSubtitle} maxLength={200} onChange={(e) => set("heroSubtitle", e.target.value)} placeholder="Best prices on every product" /></label>
        </div>
      </div>

      

      <p className="pt-1 text-sm font-bold text-white">More options <span className="text-[11px] font-normal text-slate-400">(optional, open any one)</span></p>

      <Section title="1. Colors and font" hint="Fine-tune any color or the font">
      <div>
        <p className="text-xs text-slate-400 mb-2">Quick themes</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(presets).map(([name, p]) => (
            <button key={name} onClick={() => setTheme({ ...theme, ...(p as Theme), preset: name })}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs capitalize cursor-pointer ${theme.preset === name ? "border-indigo-500 text-white" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}>
              <span className="h-3 w-3 rounded-full" style={{ background: p.primary }} /><span className="h-3 w-3 rounded-full" style={{ background: p.accent }} />{name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {color("primary", "Main color")}{color("accent", "Accent color")}{color("background", "Page background")}{color("surface", "Cards / panels")}{color("foreground", "Text color")}
        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">Font
          <select value={theme.font} onChange={(e) => set("font", e.target.value)} className="max-w-[55%] bg-slate-950 border border-slate-700 rounded px-2 py-2 text-base sm:text-sm text-white">
            {Object.entries(fonts).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>
      </Section>

      <Section title="2. Layout and style" hint="Cards, corners, background, login page design">
      <div className="space-y-3">
        {CHOICES.map((c) => (
          <div key={c.key as string}>
            <p className="text-[11px] text-slate-400 mb-1">{c.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {c.options.map(([v, l]) => (
                <button key={String(v)} onClick={() => set(c.key, v)}
                  className={`min-h-9 px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${String(theme[c.key]) === String(v) ? "border-indigo-500 bg-indigo-500/10 text-white" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}>{l}</button>
              ))}
            </div>
          </div>
        ))}
        {theme.backdrop === "image" && <ImageUploader label="Background picture" value={theme.backdropImageUrl} onChange={(u) => set("backdropImageUrl", u)} hint="A dark or blurred picture works best so text stays easy to read." />}
        <div className="flex flex-col gap-3 text-xs text-slate-300">
          <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="h-5 w-5 shrink-0" checked={theme.showStats} onChange={(e) => set("showStats", e.target.checked)} />Show the small info tiles under the banner</label>
          <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="h-5 w-5 shrink-0" checked={theme.motion} onChange={(e) => set("motion", e.target.checked)} />Animations</label>
        </div>
      </div>
      </Section>

      <Section title="3. Banner picture and login page" hint="Pictures and animations">
      <div className="grid gap-3">
        <ImageUploader label="Login page character picture" hint="Transparent PNG looks best." value={theme.loginCharacterUrl || ""} onChange={(u) => set("loginCharacterUrl", u)} />
        <ImageUploader label="Login page pet picture" hint="Small transparent PNG." value={theme.loginPetUrl || ""} onChange={(u) => set("loginPetUrl", u)} />
        {theme.heroLayout === "split" && <ImageUploader label="Banner picture (shown next to your title)" value={theme.heroImageUrl} onChange={(u) => set("heroImageUrl", u)} />}
      </div>

      </Section>

      <Section title="4. Announcement and footer" hint="Top notice bar and footer line">
      <div className="grid gap-3">
        <ImageUploader label="Logo" hint="Square picture, shows in the top bar and the browser tab." value={theme.logoUrl} onChange={(u) => set("logoUrl", u)} />
        <label className="text-xs text-slate-400">Announcement<input className={field} value={theme.announcement} maxLength={200} onChange={(e) => set("announcement", e.target.value)} /></label>
        <label className="text-xs text-slate-400">Footer text<input className={field} value={theme.footerText} maxLength={200} onChange={(e) => set("footerText", e.target.value)} /></label>
      </div>
      </Section>

      <Section title="5. Contact links and chat button" hint="WhatsApp, Instagram, YouTube in your footer">
      <div className="grid gap-3">
        <label className="text-xs text-slate-400">WhatsApp number with country code (no + or spaces)<input className={field} inputMode="numeric" value={theme.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="919876543210" /></label>
        <label className="text-xs text-slate-400">Instagram username<input className={field} value={theme.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="mystore.official" /></label>
        <label className="text-xs text-slate-400">YouTube link<input className={field} value={theme.youtube} onChange={(e) => set("youtube", e.target.value)} placeholder="https://youtube.com/@mystore" /></label>
        <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer"><input type="checkbox" className="h-5 w-5 shrink-0" checked={theme.floatingChat} onChange={(e) => set("floatingChat", e.target.checked)} />Show a round chat button on every page (opens WhatsApp, or Telegram if no WhatsApp)</label>
      </div>
      </Section>

      <div className="rounded-xl p-4 border space-y-3" style={{ background: theme.background, color: theme.foreground, borderColor: theme.primary }}>
        <div className={theme.heroLayout === "centered" ? "text-center" : "text-left"}>
          <p className="text-sm font-bold">{theme.heroTitle || brandName || "Your store"}</p>
          <p className="text-xs opacity-70 mb-2">{theme.heroSubtitle || theme.tagline || "Preview"}</p>
          <span className="inline-block px-3 py-1.5 text-xs font-semibold" style={{ borderRadius: theme.radius === "sharp" ? 0 : theme.radius === "pill" ? 999 : 10, background: theme.buttonStyle === "solid" ? theme.primary : `linear-gradient(90deg, ${theme.primary}, ${theme.accent})`, color: "#fff" }}>{theme.ctaText || "Browse products"}</span>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(theme.columns, 3)}, minmax(0,1fr))` }}>
          {Array.from({ length: theme.columns * 1 }).map((_, i) => (
            <div key={i} className="h-14 text-[10px] p-2" style={{
              borderRadius: theme.radius === "sharp" ? 0 : theme.radius === "soft" ? 8 : theme.radius === "pill" ? 26 : 16,
              background: theme.cardStyle === "outline" ? "transparent" : theme.cardStyle === "glass" ? "rgba(255,255,255,.06)" : theme.surface,
              border: theme.cardStyle === "outline" ? `2px solid ${theme.primary}` : "1px solid rgba(128,128,128,.25)",
              boxShadow: theme.cardStyle === "elevated" ? "0 8px 18px rgba(0,0,0,.4)" : undefined,
            }}>Product {i + 1}</div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={saving} className="flex w-full sm:w-auto items-center justify-center gap-2 px-5 py-3 shadow-lg shadow-black/40 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save branding
        </button>
        {dirty && <button onClick={undo} className="min-h-11 rounded-xl border border-slate-600 bg-slate-900/90 px-4 text-xs font-semibold text-slate-200 cursor-pointer">Undo changes</button>}
        {dirty && <span className="rounded-full bg-amber-500/20 px-3 py-1 text-[11px] font-semibold text-amber-300">Not saved yet</span>}
      </div>

      <LivePreview version={previewVersion} />
    </div>
  );
}
