"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

type Theme = {
  preset?: string; primary: string; accent: string; background: string; surface: string; foreground: string;
  font: string; logoUrl: string; tagline: string; announcement: string; footerText: string;
};
const field = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500";

export default function BrandingManager() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [presets, setPresets] = useState<Record<string, Partial<Theme>>>({});
  const [fonts, setFonts] = useState<Record<string, string>>({});
  const [brandName, setBrandName] = useState("");
  const [telegram, setTelegram] = useState("");
  const [kind, setKind] = useState("coadmin");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/branding", { cache: "no-store" });
      const j = await res.json();
      if (j.success) { setTheme(j.theme); setPresets(j.presets); setFonts(j.fonts); setBrandName(j.brandName); setTelegram(j.telegram || ""); setKind(j.kind); }
    })();
  }, []);

  if (!theme) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  const set = (k: keyof Theme, v: string) => setTheme({ ...theme, [k]: v, ...(["primary", "accent", "background", "surface", "foreground"].includes(k) ? { preset: "custom" } : {}) });

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const body: any = { theme };
      if (kind === "coadmin") { body.brandName = brandName; body.telegram = telegram; }
      const res = await fetch("/api/admin/branding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      setMsg(j.success ? { ok: true, text: "Saved. Reload the store to see it." } : { ok: false, text: j.error || "Could not save." });
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

      <div className="grid gap-3">
        <label className="text-xs text-slate-400">Logo image link (https only)<input className={field} value={theme.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://..." /></label>
        <label className="text-xs text-slate-400">Tagline<input className={field} value={theme.tagline} maxLength={120} onChange={(e) => set("tagline", e.target.value)} /></label>
        <label className="text-xs text-slate-400">Announcement<input className={field} value={theme.announcement} maxLength={200} onChange={(e) => set("announcement", e.target.value)} /></label>
        <label className="text-xs text-slate-400">Footer text<input className={field} value={theme.footerText} maxLength={200} onChange={(e) => set("footerText", e.target.value)} /></label>
      </div>

      <div className="rounded-xl p-4 border" style={{ background: theme.background, color: theme.foreground, borderColor: theme.primary }}>
        <p className="text-sm font-bold">{brandName || "Your store"}</p>
        <p className="text-xs opacity-70 mb-3">{theme.tagline || "Preview"}</p>
        <span className="inline-block px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: `linear-gradient(90deg, ${theme.primary}, ${theme.accent})`, color: "#fff" }}>Buy now</span>
      </div>

      <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save branding
      </button>
    </div>
  );
}
