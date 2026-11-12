"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import StoreOptionsCard from "@/components/admin/StoreOptionsCard";
import LivePreview from "@/components/admin/LivePreview";

type Theme = {
  preset?: string; primary: string; accent: string; background: string; surface: string; foreground: string;
  font: string; logoUrl: string; tagline: string; announcement: string; footerText: string;
  radius: string; cardStyle: string; backdrop: string; backdropImageUrl: string; heroLayout: string; heroTitle: string;
  heroSubtitle: string; heroImageUrl: string; loginCharacterUrl: string; loginPetUrl: string; loginCard: string; loginBg: string; ctaText: string; columns: number; fontScale: string; buttonStyle: string;
  showStats: boolean; motion: boolean;
};
const CHOICES: { key: keyof Theme; label: string; options: [string | number, string][] }[] = [
  { key: "heroLayout", label: "Top banner layout", options: [["centered", "Centered"], ["left", "Left aligned"], ["split", "Text + picture"]] },
  { key: "cardStyle", label: "Product cards", options: [["glass", "Glass"], ["solid", "Solid"], ["outline", "Outline"], ["elevated", "Shadow"]] },
  { key: "radius", label: "Corners", options: [["sharp", "Square"], ["soft", "Slightly round"], ["round", "Round"], ["pill", "Very round"]] },
  { key: "columns", label: "Products per row (large screens)", options: [[2, "2"], [3, "3"], [4, "4"]] },
  { key: "backdrop", label: "Page background", options: [["solid", "Plain"], ["gradient", "Gradient"], ["aurora", "Glow"], ["grid", "Grid lines"], ["image", "Picture"]] },
  { key: "loginCard", label: "Login page card design", options: [["original", "Original"], ["glass", "Glass Glow"], ["frost", "Frost Light"], ["neon", "Neon Outline"], ["minimal", "Clean Minimal"], ["aurora", "Aurora Border"]] },
  { key: "loginBg", label: "Login page background animation", options: [["original", "Original"], ["aurora", "Aurora Glow"], ["particles", "Particle Network"], ["beams", "Grid Beams"], ["waves", "Silk Waves"], ["stars", "Star Warp"]] },
  { key: "buttonStyle", label: "Buttons", options: [["gradient", "Two-color gradient"], ["solid", "Single color"]] },
  { key: "fontScale", label: "Text size", options: [["small", "Small"], ["normal", "Normal"], ["large", "Large"]] },
];
const field = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500";

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

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/branding", { cache: "no-store" });
      const j = await res.json();
      if (j.success) { setTheme(j.theme); setPresets(j.presets); setFonts(j.fonts); setBrandName(j.brandName); setTelegram(j.telegram || ""); setKind(j.kind); }
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
      if (j.success) setPreviewVersion((n) => n + 1);
      setMsg(j.success ? { ok: true, text: "Saved. Preview updated below." } : { ok: false, text: j.error || "Could not save." });
    } catch { setMsg({ ok: false, text: "Network error." }); }
    setSaving(false);
  }

  const color = (k: keyof Theme, label: string) => (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
      {label}
      <span className="flex items-center gap-2">
        <input type="color" value={String(theme[k])} onChange={(e) => set(k, e.target.value)} className="h-7 w-9 bg-transparent cursor-pointer" />
        <input value={String(theme[k])} onChange={(e) => set(k, e.target.value)} className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-[11px] text-white" maxLength={7} />
      </span>
    </label>
  );

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-white">Store branding</h2>
        <p className="text-xs text-slate-400">Colors, font, logo and text for your customers' website.</p>
      </div>
      {msg && <div className={`rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>{msg.text}</div>}

      <StoreOptionsCard />

      {kind === "coadmin" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs text-slate-400">Brand name<input className={field} value={brandName} maxLength={40} onChange={(e) => setBrandName(e.target.value)} /></label>
          <label className="text-xs text-slate-400">Telegram username<input className={field} value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="yourname" /></label>
        </div>
      )}

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

      <div className="grid sm:grid-cols-2 gap-2">
        {color("primary", "Main color")}{color("accent", "Accent color")}{color("background", "Page background")}{color("surface", "Cards / panels")}{color("foreground", "Text color")}
        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">Font
          <select value={theme.font} onChange={(e) => set("font", e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white">
            {Object.entries(fonts).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-200">Layout and style (this is what makes your store look different)</p>
        {CHOICES.map((c) => (
          <div key={c.key as string}>
            <p className="text-[11px] text-slate-400 mb-1">{c.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {c.options.map(([v, l]) => (
                <button key={String(v)} onClick={() => set(c.key, v)}
                  className={`px-2.5 py-1 rounded-md border text-xs cursor-pointer ${String(theme[c.key]) === String(v) ? "border-indigo-500 bg-indigo-500/10 text-white" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}>{l}</button>
              ))}
            </div>
          </div>
        ))}
        {theme.backdrop === "image" && <label className="text-xs text-slate-400 block">Background picture link (https)<input className={field} value={theme.backdropImageUrl} onChange={(e) => set("backdropImageUrl", e.target.value)} placeholder="https://..." /></label>}
        <div className="flex flex-wrap gap-4 text-xs text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={theme.showStats} onChange={(e) => set("showStats", e.target.checked)} />Show the small info tiles under the banner</label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={theme.motion} onChange={(e) => set("motion", e.target.checked)} />Animations</label>
        </div>
      </div>

      <div className="grid gap-3">
        <p className="text-xs font-semibold text-slate-200">Top banner text</p>
        <label className="text-xs text-slate-400">Big title (leave empty to use your brand name)<input className={field} value={theme.heroTitle} maxLength={60} onChange={(e) => set("heroTitle", e.target.value)} /></label>
        <label className="text-xs text-slate-400">Sub text<input className={field} value={theme.heroSubtitle} maxLength={200} onChange={(e) => set("heroSubtitle", e.target.value)} /></label>
        <label className="text-xs text-slate-400">Button text<input className={field} value={theme.ctaText} maxLength={24} onChange={(e) => set("ctaText", e.target.value)} placeholder="Browse products" /></label>
        <label className="text-xs text-slate-400">Login page character picture link (https, transparent PNG)<input className={field} value={theme.loginCharacterUrl || ""} onChange={(e) => set("loginCharacterUrl", e.target.value)} placeholder="https://... (empty = default)" /></label>
        <label className="text-xs text-slate-400">Login page pet picture link (https, transparent PNG)<input className={field} value={theme.loginPetUrl || ""} onChange={(e) => set("loginPetUrl", e.target.value)} placeholder="https://... (empty = default)" /></label>
        {theme.heroLayout === "split" && <label className="text-xs text-slate-400">Banner picture link (https)<input className={field} value={theme.heroImageUrl} onChange={(e) => set("heroImageUrl", e.target.value)} placeholder="https://..." /></label>}
      </div>

      <div className="grid gap-3">
        <label className="text-xs text-slate-400">Logo image link (https only)<input className={field} value={theme.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://..." /></label>
        <label className="text-xs text-slate-400">Tagline<input className={field} value={theme.tagline} maxLength={120} onChange={(e) => set("tagline", e.target.value)} /></label>
        <label className="text-xs text-slate-400">Announcement<input className={field} value={theme.announcement} maxLength={200} onChange={(e) => set("announcement", e.target.value)} /></label>
        <label className="text-xs text-slate-400">Footer text<input className={field} value={theme.footerText} maxLength={200} onChange={(e) => set("footerText", e.target.value)} /></label>
      </div>

      <div className="rounded-xl p-4 border space-y-3" style={{ background: theme.background, color: theme.foreground, borderColor: theme.primary }}>
        <div className={theme.heroLayout === "centered" ? "text-center" : "text-left"}>
          <p className="text-sm font-bold">{theme.heroTitle || brandName || "Your store"}</p>
          <p className="text-xs opacity-70 mb-2">{theme.heroSubtitle || theme.tagline || "Preview"}</p>
          <span className="inline-block px-3 py-1.5 text-xs font-semibold" style={{ borderRadius: theme.radius === "sharp" ? 0 : theme.radius === "pill" ? 999 : 10, background: theme.buttonStyle === "solid" ? theme.primary : `linear-gradient(90deg, ${theme.primary}, ${theme.accent})`, color: "#fff" }}>{theme.ctaText || "Browse products"}</span>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${theme.columns}, minmax(0,1fr))` }}>
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

      <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save branding
      </button>

      <LivePreview version={previewVersion} />
    </div>
  );
}
