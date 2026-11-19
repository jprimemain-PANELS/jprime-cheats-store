import type { DesignId } from "@/lib/store-designs";
import { DEFAULT_THEME, FONTS, contrastRatio, type Radius, type Theme } from "@/lib/theme";

/**
 * Site-wide CSS for the store designs (static, no JavaScript animation, so it costs almost no server CPU).
 * It is injected in <head> by app/layout.tsx and scoped to html[data-design="id"], so EVERY page
 * (home, login, profile, QR payment, wallet dialog, legal pages, loading screens) gets the same look.
 *
 * Branding connection: the design has its own default palette, but when the store admin has saved custom
 * colours / font / corner style in Branding, those win (see designPalette()). All structural rules below use
 * the --store-* variables, never fixed colours, so they follow the store's Branding automatically.
 */
type Id = Exclude<DesignId, "classic">;
type Pal = { bg: string; surface: string; fg: string; primary: string; accent: string; font: string; radius: Radius };
type FullPal = Pal & { customColors: boolean; customCard: boolean; customHover: boolean };

const DEFAULTS: Record<Id, Pal> = {
  folio: { bg: "#0a0a0a", surface: "#121212", fg: "#f5f5f5", primary: "#ff6a1a", accent: "#ff6a1a", font: "'Helvetica Neue',Helvetica,Arial,system-ui,sans-serif", radius: "sharp" },
  neon: { bg: "#05060f", surface: "#0a0e22", fg: "#e8f7ff", primary: "#22e5ff", accent: "#ff2bd6", font: "ui-sans-serif,system-ui,'Segoe UI',Roboto,sans-serif", radius: "pill" },
  editorial: { bg: "#2a3320", surface: "#323d26", fg: "#f1ecd9", primary: "#cdd9a0", accent: "#d9c98a", font: "ui-serif,Georgia,'Times New Roman',serif", radius: "soft" },
  floatglass: { bg: "#150a33", surface: "#24145a", fg: "#f5f0ff", primary: "#8b5cf6", accent: "#c084fc", font: "ui-rounded,'SF Pro Rounded',Nunito,'Trebuchet MS',system-ui,sans-serif", radius: "pill" },
  arena: { bg: "#0a0a0f", surface: "#14141c", fg: "#f4f4f6", primary: "#ff2e4d", accent: "#ffb020", font: "'Bahnschrift','Arial Narrow','Helvetica Neue',Arial,system-ui,sans-serif", radius: "sharp" },
  console: { bg: "#0b1220", surface: "#111b30", fg: "#e6edf7", primary: "#3b82f6", accent: "#38bdf8", font: "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", radius: "soft" },
  retrowave: { bg: "#0d0221", surface: "#1a0838", fg: "#fdf2ff", primary: "#ff3ea5", accent: "#ffa31a", font: "'Trebuchet MS','Segoe UI',Verdana,system-ui,sans-serif", radius: "round" },
};

const mix = (c: string, pct: number, w: string) => `color-mix(in srgb, ${c} ${pct}%, ${w})`;
const scale = (name: string, v: string) =>
  `--color-${name}-200:${mix(v, 35, "#fff")};--color-${name}-300:${mix(v, 55, "#fff")};--color-${name}-400:${mix(v, 78, "#fff")};--color-${name}-500:${v};--color-${name}-600:${mix(v, 86, "#000")};--color-${name}-700:${mix(v, 68, "#000")};`;
const RADIUS: Record<Radius, string> = {
  sharp: "--radius-md:0;--radius-lg:0;--radius-xl:0;--radius-2xl:0;--radius-3xl:0;--radius-full:2px;",
  soft: "--radius-md:6px;--radius-lg:8px;--radius-xl:10px;--radius-2xl:12px;--radius-3xl:14px;",
  round: "",
  pill: "--radius-lg:1rem;--radius-xl:1.25rem;--radius-2xl:1.75rem;--radius-3xl:2.25rem;",
};

const COLOR_KEYS = ["primary", "accent", "background", "surface", "foreground"] as const;

/** The design's own palette, overridden by whatever the store saved in Branding (colours, font, corners, card style). */
export function designPalette(id: Id, theme?: Theme | null): FullPal {
  const p: Pal = { ...DEFAULTS[id] };
  let customColors = false;
  if (theme) {
    customColors = COLOR_KEYS.some((k) => theme[k] !== DEFAULT_THEME[k]);
    if (customColors) {
      p.primary = theme.primary;
      p.accent = theme.buttonStyle === "solid" ? theme.primary : theme.accent;
      p.bg = theme.background;
      p.surface = theme.surface;
      p.fg = theme.foreground;
    }
    if (theme.font !== "default" && FONTS[theme.font]) p.font = FONTS[theme.font].stack;
    if (theme.radius !== "round") p.radius = theme.radius;
  }
  return { ...p, customColors, customCard: !!theme && theme.cardStyle !== "glass", customHover: !!theme && theme.cardHover !== "none" };
}

const isLight = (bg: string) => contrastRatio(bg, "#ffffff") < contrastRatio(bg, "#000000");
const onColor = (c: string) => (contrastRatio(c, "#ffffff") >= 3 ? "#ffffff" : "#0b0b0b");

const COMMON = `
@keyframes dz-spin{to{transform:rotate(360deg)}}
@keyframes dz-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes dz-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes dz-drift{0%,100%{transform:translate(0,0)}50%{transform:translate(24px,-18px)}}
.dz-spin{animation:dz-spin .9s linear infinite}
.dz-rise{animation:dz-rise .45s cubic-bezier(.16,1,.3,1) both}
.dz-float{animation:dz-float 5.5s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.dz-spin,.dz-rise,.dz-float,.dz-orb span{animation:none!important}}
`;

/** Rules every design shares: variables, backgrounds of every page, text/border remaps, loaders. */
function base(id: Id, p: FullPal) {
  const s = `html[data-design="${id}"]`;
  const light = isLight(p.bg);
  const line = mix(p.fg, 16, "transparent");
  return [
    `${s}{--store-primary:${p.primary};--store-accent:${p.accent};--store-bg:${p.bg};--store-surface:${p.surface};--store-fg:${p.fg};--store-on:${onColor(p.primary)};--store-line:${line};--font-sans:${p.font};`,
    scale("violet", p.primary), scale("fuchsia", p.accent), scale("cyan", p.primary), RADIUS[p.radius],
    `--background:${p.bg};--foreground:${p.fg};--card:${p.surface};--card-foreground:${p.fg};--popover:${p.surface};--popover-foreground:${p.fg};--primary:${p.primary};--accent:${p.accent};--ring:${p.primary};--border:${line};`,
    `color-scheme:${light ? "light" : "dark"};color:${p.fg};font-family:${p.font};background-color:${p.bg};}`,
    // the body is transparent so the design's fixed backdrop (body::before/::after) shows behind every page
    `${s} body{background:transparent!important;color:${p.fg};font-family:${p.font}}`,
    // every page-level hard-coded dark background -> the design's backdrop; every panel/modal one -> the design's surface
    `${s} .bg-\\[\\#050506\\],${s} .bg-\\[\\#050608\\],${s} .bg-\\[\\#07040f\\],${s} .bg-\\[\\#070b12\\],${s} .bg-background{background-color:transparent!important;background-image:none!important}`,
    `${s} .bg-\\[\\#0b0714\\],${s} .bg-\\[\\#0E1013\\],${s} .bg-\\[\\#0A0B0D\\],${s} .bg-\\[\\#120c1f\\],${s} .bg-\\[\\#14110a\\],${s} .bg-\\[\\#120a25\\],${s} .bg-\\[\\#10091f\\],${s} .bg-\\[\\#0e0c07\\],${s} .bg-\\[\\#0c081a\\],${s} .bg-\\[\\#0b1426\\],${s} .bg-\\[\\#0b0718\\],${s} .bg-\\[\\#090514\\],${s} .bg-\\[\\#080511\\]{background-color:var(--store-surface)!important}`,
    `${s} .text-white,${s} .text-zinc-100,${s} .text-zinc-200{color:var(--store-fg)!important}`,
    `${s} [class*="border-white/"],${s} [class*="border-zinc-8"]{border-color:var(--store-line)!important}`,
    // text sitting on a solid primary button must stay readable whatever the primary colour is
    `${s} [class*="from-violet-600"],${s} [class*="bg-violet-600"]:not([class*="bg-violet-600/"]),${s} [class*="bg-violet-500"]:not([class*="bg-violet-500/"]){color:var(--store-on)!important}`,
    `${s} [class*="from-violet-600"] svg,${s} [class*="bg-violet-600"]:not([class*="bg-violet-600/"]) svg{color:var(--store-on)!important}`,
    `${s} footer{background:${mix(p.bg, 88, "transparent")}!important;border-color:var(--store-line)!important}`,
    // loading spinners (session check, profile loading, QR page) follow the design
    `${s} .jprime-spin,${s} .animate-spin{border-color:var(--store-line)!important;border-top-color:var(--store-primary)!important;border-right-color:var(--store-accent)!important}`,
    // light palettes: translucent-white text and black tints (written for dark pages) become foreground-based so nothing turns invisible
    light ? `${s} [class*="text-white/"]{color:color-mix(in srgb,var(--store-fg) 62%,transparent)!important}${s} [class*="bg-black/"]{background-color:color-mix(in srgb,var(--store-fg) 6%,transparent)!important}${s} input,${s} select,${s} textarea{background-color:var(--store-surface)!important;color:var(--store-fg)!important}${s} [data-login-card] input{background-color:rgba(0,0,0,.35)!important;color:#fff!important}${s} [data-login-card] .text-white,${s} [data-login-card] .text-zinc-300,${s} [data-login-card] .text-zinc-400{color:#fff!important}${s} [data-login-card] [class*="text-white/"]{color:rgba(255,255,255,.65)!important}${s} .text-zinc-300,${s} .text-zinc-400,${s} .text-slate-300,${s} .text-slate-400{color:color-mix(in srgb,var(--store-fg) 72%,transparent)!important}` : "",
    `${s} ::selection{background:var(--store-primary);color:var(--store-on)}`,
    `${s} ::-webkit-scrollbar{width:10px;height:10px}${s} ::-webkit-scrollbar-thumb{background:${mix(p.primary, 45, "transparent")};border-radius:8px}${s} ::-webkit-scrollbar-track{background:transparent}`,
    `${s},${s} body{overflow-x:clip}`,
  ].join("");
}

function rules(id: Id, p: FullPal): string {
  const S = `html[data-design="${id}"]`;
  const pr = "var(--store-primary)", ac = "var(--store-accent)", fg = "var(--store-fg)", bg = "var(--store-bg)", sf = "var(--store-surface)";
  const card = (css: string) => (p.customCard ? "" : `${S} [data-store-card]{${css}}`);
  const hov = (css: string) => (p.customHover ? "" : `${S} [data-store-card]:hover{${css}}`);
  switch (id) {
    case "folio":
      return [
        `${S} body::before{content:"";position:fixed;left:0;right:0;top:0;height:4px;background:${ac};z-index:200;pointer-events:none}`,
        `${S} h1,${S} h2,${S} h3{letter-spacing:-.025em}`,
        `${S} [data-login-card],${S} [role="dialog"]{border-radius:0!important;border:1px solid ${fg}!important;backdrop-filter:none!important;box-shadow:8px 8px 0 ${mix(p.primary, 90, "transparent")}!important}`,
        card(`background:${sf}!important;border:1px solid var(--store-line)!important;border-radius:0!important;backdrop-filter:none!important;transition:border-color .2s,transform .2s`),
        hov(`border-color:var(--store-accent)!important;box-shadow:none!important;transform:translateY(-3px)`),
      ].join("");
    case "neon":
      return [
        `${S} body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(60% 40% at 50% 0%,${mix(p.primary, 18, "transparent")},transparent 70%),radial-gradient(50% 40% at 92% 30%,${mix(p.accent, 16, "transparent")},transparent 70%),linear-gradient(${mix(p.primary, 7, "transparent")} 1px,transparent 1px),linear-gradient(90deg,${mix(p.primary, 7, "transparent")} 1px,transparent 1px);background-size:auto,auto,46px 46px,46px 46px;-webkit-mask-image:linear-gradient(#000 60%,transparent);mask-image:linear-gradient(#000 60%,transparent)}`,
        `${S} [data-login-card],${S} [role="dialog"]{border:1px solid ${mix(p.primary, 45, "transparent")}!important;box-shadow:0 0 44px -14px ${pr}!important}`,
        card(`background:${mix(p.surface, 72, "transparent")}!important;border:1px solid ${mix(p.primary, 32, "transparent")}!important;box-shadow:0 0 34px -14px ${pr}!important;transition:box-shadow .25s,border-color .25s`),
        hov(`border-color:var(--store-accent)!important;box-shadow:0 0 44px -10px var(--store-accent)!important`),
        `.dz-neon-text{background:linear-gradient(90deg,${mix(p.primary, 70, "#fff")},${mix(p.accent, 70, "#fff")});-webkit-background-clip:text;background-clip:text;color:transparent}`,
        `.dz-orb{position:relative;width:min(56vw,250px);aspect-ratio:1}`,
        `.dz-orb span{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,${pr},${ac},${mix(p.primary, 50, "#7c3aed")},${pr});-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 7px),#000 calc(100% - 6px));mask:radial-gradient(farthest-side,transparent calc(100% - 7px),#000 calc(100% - 6px));filter:drop-shadow(0 0 14px ${pr});animation:dz-spin 9s linear infinite}`,
        `.dz-orb span+span{inset:13%;animation-direction:reverse;animation-duration:6s;filter:drop-shadow(0 0 12px ${ac})}`,
        `.dz-orb i{position:absolute;inset:27%;border-radius:50%;background:radial-gradient(circle at 34% 30%,#fff,${mix(p.primary, 45, "#fff")} 18%,${mix(p.accent, 55, "#12082e")} 56%,#12082e 100%);box-shadow:0 0 70px 6px ${mix(p.primary, 55, "transparent")},inset -10px -14px 30px rgba(0,0,0,.5)}`,
      ].join("");
    case "editorial":
      return [
        `${S} body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(70% 45% at 85% 0%,${mix(p.primary, 14, "transparent")},transparent 70%),repeating-linear-gradient(0deg,transparent 0 3px,${mix(p.fg, 2.5, "transparent")} 3px 4px)}`,
        `${S} h1,${S} h2,${S} h3,${S} h4{font-family:ui-serif,Georgia,'Times New Roman',serif;font-weight:500;letter-spacing:-.015em}`,
        `${S} [data-login-card],${S} [role="dialog"]{border:1px solid ${mix(p.fg, 35, "transparent")}!important;border-radius:1.5rem!important;box-shadow:none!important;backdrop-filter:none!important}`,
        card(`background:${sf}!important;border:1px solid ${mix(p.fg, 28, "transparent")}!important;border-radius:1.25rem!important;backdrop-filter:none!important;box-shadow:none!important`),
        hov(`border-color:var(--store-accent)!important`),
        `.dz-serif{font-family:ui-serif,Georgia,'Times New Roman',serif}`,
      ].join("");
    case "floatglass":
      return [
        `${S}{background-image:linear-gradient(160deg,${bg} 0%,${mix(p.primary, 28, p.bg)} 55%,${mix(p.primary, 62, p.bg)} 100%);background-attachment:fixed}`,
        `${S} body::before{content:"";position:fixed;top:-100px;right:-80px;width:380px;height:380px;border-radius:50%;background:${pr};filter:blur(90px);opacity:.5;z-index:-1;pointer-events:none;animation:dz-drift 16s ease-in-out infinite}`,
        `${S} body::after{content:"";position:fixed;bottom:-120px;left:18%;width:340px;height:340px;border-radius:50%;background:${ac};filter:blur(90px);opacity:.4;z-index:-1;pointer-events:none;animation:dz-drift 16s ease-in-out -6s infinite}`,
        `${S} [data-login-card],${S} [role="dialog"]{background:${mix(p.fg, 9, "transparent")}!important;border:1px solid ${mix(p.fg, 24, "transparent")}!important;backdrop-filter:blur(22px)!important;border-radius:2rem!important;box-shadow:0 24px 60px -24px rgba(0,0,0,.6)!important}`,
        card(`background:${mix(p.fg, 8, "transparent")}!important;border:1px solid ${mix(p.fg, 22, "transparent")}!important;backdrop-filter:blur(18px)!important;border-radius:2rem!important;box-shadow:0 24px 50px -24px rgba(0,0,0,.6)!important`),
        `@media (prefers-reduced-motion:reduce){${S} body::before,${S} body::after{animation:none}}`,
      ].join("");
    case "arena":
      return [
        `${S} body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(115deg,${mix(p.primary, 14, "transparent")} 0 18%,transparent 18% 100%),repeating-linear-gradient(0deg,transparent 0 3px,${mix(p.fg, 2.5, "transparent")} 3px 4px)}`,
        `${S} body::after{content:"";position:fixed;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,${pr} 0 30%,${ac} 30% 38%,transparent 38%);z-index:200;pointer-events:none}`,
        `${S} h1,${S} h2,${S} h3{text-transform:uppercase;font-style:italic;font-weight:800;letter-spacing:.01em}`,
        `${S} [data-login-card],${S} [role="dialog"]{border:1px solid ${mix(p.primary, 50, "transparent")}!important;border-left:4px solid ${pr}!important;border-radius:0!important;backdrop-filter:none!important;box-shadow:none!important;clip-path:polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,0 100%)}`,
        card(`background:${sf}!important;border:1px solid var(--store-line)!important;border-left:4px solid var(--store-primary)!important;border-radius:0!important;backdrop-filter:none!important;box-shadow:none!important;clip-path:polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,0 100%);transition:transform .2s`),
        hov(`transform:translateX(4px);border-left-color:var(--store-accent)!important`),
        `.dz-slant{transform:skewX(-10deg)}.dz-slant>*{transform:skewX(10deg)}`,
        `.dz-hud{position:relative}.dz-hud::before,.dz-hud::after{content:"";position:absolute;width:16px;height:16px;border:2px solid ${pr};pointer-events:none}.dz-hud::before{top:-1px;left:-1px;border-right:0;border-bottom:0}.dz-hud::after{bottom:-1px;right:-1px;border-left:0;border-top:0}`,
        `.dz-bar{height:6px;background:${mix(p.fg, 12, "transparent")};position:relative;overflow:hidden}.dz-bar>i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,${pr},${ac})}`,
      ].join("");
    case "console":
      return [
        `${S} body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(60% 30% at 50% 0%,${mix(p.primary, 14, "transparent")},transparent 70%),radial-gradient(${mix(p.fg, 9, "transparent")} 1px,transparent 1px);background-size:auto,22px 22px}`,
        `${S} [data-login-card],${S} [role="dialog"]{border:1px solid var(--store-line)!important;border-top:3px solid ${pr}!important;border-radius:12px!important;backdrop-filter:none!important;box-shadow:0 18px 50px -24px rgba(0,0,0,.7)!important}`,
        card(`background:${sf}!important;border:1px solid var(--store-line)!important;border-radius:12px!important;backdrop-filter:none!important;transition:border-color .2s,box-shadow .2s`),
        hov(`border-color:var(--store-primary)!important;box-shadow:0 12px 30px -16px var(--store-primary)!important`),
        `.dz-panel{background:${sf};border:1px solid var(--store-line);border-radius:12px}`,
        `.dz-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.2)}`,
      ].join("");
    case "retrowave":
      return [
        `${S}{background-image:linear-gradient(180deg,${bg} 0%,${mix(p.primary, 22, p.bg)} 62%,${mix(p.accent, 30, p.bg)} 100%);background-attachment:fixed}`,
        `${S} body::before{content:"";position:fixed;left:50%;bottom:26vh;width:min(78vw,430px);aspect-ratio:1;transform:translateX(-50%);border-radius:50%;background:linear-gradient(180deg,${ac},${pr});opacity:.34;z-index:-1;pointer-events:none;-webkit-mask-image:repeating-linear-gradient(180deg,#000 0 62%,transparent 62% 64%,#000 64% 72%,transparent 72% 75%,#000 75% 82%,transparent 82% 86%,#000 86% 92%,transparent 92% 97%,#000 97%);mask-image:repeating-linear-gradient(180deg,#000 0 62%,transparent 62% 64%,#000 64% 72%,transparent 72% 75%,#000 75% 82%,transparent 82% 86%,#000 86% 92%,transparent 92% 97%,#000 97%)}`,
        `${S} body::after{content:"";position:fixed;left:-60%;right:-60%;bottom:0;height:34vh;z-index:-1;pointer-events:none;background:linear-gradient(180deg,transparent,${mix(p.primary, 30, "transparent")}),repeating-linear-gradient(90deg,${mix(p.primary, 70, "transparent")} 0 1.5px,transparent 1.5px 64px),repeating-linear-gradient(0deg,${mix(p.primary, 70, "transparent")} 0 1.5px,transparent 1.5px 42px);transform:perspective(260px) rotateX(58deg);transform-origin:50% 100%;-webkit-mask-image:linear-gradient(transparent,#000 70%);mask-image:linear-gradient(transparent,#000 70%)}`,
        `${S} h1,${S} h2,${S} h3{font-style:italic;font-weight:900;letter-spacing:-.01em;text-shadow:0 0 22px ${mix(p.primary, 55, "transparent")}}`,
        `${S} [data-login-card],${S} [role="dialog"]{border:2px solid ${mix(p.primary, 65, "transparent")}!important;box-shadow:0 0 40px -10px ${pr},inset 0 0 30px -18px ${ac}!important}`,
        card(`background:${mix(p.surface, 92, "transparent")}!important;border:2px solid ${mix(p.primary, 55, "transparent")}!important;box-shadow:0 0 28px -12px var(--store-primary)!important;backdrop-filter:blur(6px)!important;transition:transform .2s,box-shadow .2s`),
        hov(`transform:translateY(-4px) rotate(-.4deg);box-shadow:0 0 38px -8px var(--store-accent)!important`),
        `.dz-chrome{background:linear-gradient(180deg,#fff 0%,${mix(p.accent, 55, "#fff")} 45%,${ac} 50%,${pr} 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 4px 0 ${mix(p.primary, 50, "#000")})}`,
      ].join("");
  }
}

export function designCss(id: Id, theme?: Theme | null): string {
  const p = designPalette(id, theme);
  return COMMON + base(id, p) + rules(id, p);
}
