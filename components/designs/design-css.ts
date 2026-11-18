import type { DesignId } from "@/lib/store-designs";

/**
 * Static CSS for the store designs (no JavaScript animation, so it costs almost no server CPU).
 * Each design sets the same theme variables the Branding system uses (--store-*, --color-violet-*, --color-fuchsia-*, radius),
 * scoped to its own wrapper, so the existing product cards, footer and buttons pick up the design's colours automatically.
 */
const mix = (c: string, pct: number, w: string) => `color-mix(in srgb, ${c} ${pct}%, ${w})`;
const scale = (name: string, v: string) =>
  `--color-${name}-200:${mix(v, 35, "#fff")};--color-${name}-300:${mix(v, 55, "#fff")};--color-${name}-400:${mix(v, 78, "#fff")};--color-${name}-500:${v};--color-${name}-600:${mix(v, 86, "#000")};--color-${name}-700:${mix(v, 68, "#000")};`;
const RADIUS = {
  sharp: "--radius-md:0;--radius-lg:0;--radius-xl:0;--radius-2xl:0;--radius-3xl:0;--radius-full:2px;",
  soft: "--radius-md:6px;--radius-lg:8px;--radius-xl:10px;--radius-2xl:12px;--radius-3xl:14px;",
  round: "",
  pill: "--radius-lg:1rem;--radius-xl:1.25rem;--radius-2xl:1.75rem;--radius-3xl:2.25rem;",
};
type Pal = { bg: string; surface: string; fg: string; primary: string; accent: string; font: string; radius: keyof typeof RADIUS; page?: string };

function base(id: Exclude<DesignId, "classic">, p: Pal) {
  const s = `[data-design="${id}"]`;
  return [
    `${s}{--store-primary:${p.primary};--store-accent:${p.accent};--store-bg:${p.bg};--store-surface:${p.surface};--store-fg:${p.fg};--font-sans:${p.font};`,
    scale("violet", p.primary), scale("fuchsia", p.accent), RADIUS[p.radius],
    `--background:${p.bg};--foreground:${p.fg};--card:${p.surface};--card-foreground:${p.fg};--primary:${p.primary};--accent:${p.accent};--ring:${p.primary};`,
    `color-scheme:dark;color:${p.fg};font-family:${p.font};background:${p.page ?? p.bg};}`,
    `${s} .bg-\\[\\#07040f\\]{background-color:var(--store-bg)!important}${s} .bg-\\[\\#0b0714\\]{background-color:var(--store-surface)!important}`,
    `${s} .text-white,${s} .text-zinc-100,${s} .text-zinc-200{color:var(--store-fg)!important}`,
    `${s} footer{background:${mix(p.bg, 88, "transparent")}!important;border-color:${mix(p.fg, 14, "transparent")}!important}`,
  ].join("");
}

const COMMON = `
@keyframes dz-spin{to{transform:rotate(360deg)}}
@keyframes dz-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes dz-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes dz-drift{0%,100%{transform:translate(0,0)}50%{transform:translate(24px,-18px)}}
.dz-spin{animation:dz-spin .9s linear infinite}
.dz-rise{animation:dz-rise .45s cubic-bezier(.16,1,.3,1) both}
.dz-float{animation:dz-float 5.5s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.dz-spin,.dz-rise,.dz-float,.dz-orb span,.dz-blob{animation:none!important}}
`;

const FOLIO = base("folio", { bg: "#0a0a0a", surface: "#121212", fg: "#f5f5f5", primary: "#ff6a1a", accent: "#ff6a1a", font: "'Helvetica Neue',Helvetica,Arial,sans-serif", radius: "sharp" }) + `
[data-design="folio"] [data-store-card]{background:#111!important;border:1px solid rgba(255,255,255,.16)!important;border-radius:0!important;backdrop-filter:none!important;transition:border-color .2s,transform .2s}
[data-design="folio"] [data-store-card]:hover{border-color:#ff6a1a!important;box-shadow:none!important;transform:translateY(-3px)}
`;

const NEON = base("neon", { bg: "#05060f", surface: "#0a0e22", fg: "#e8f7ff", primary: "#22e5ff", accent: "#ff2bd6", font: "ui-sans-serif,system-ui,'Segoe UI',Roboto,sans-serif", radius: "pill", page: "radial-gradient(60% 40% at 50% 0%,rgba(34,229,255,.16),transparent 70%),radial-gradient(50% 40% at 90% 30%,rgba(255,43,214,.14),transparent 70%),#05060f" }) + `
[data-design="neon"] [data-store-card]{background:rgba(10,14,34,.72)!important;border:1px solid rgba(34,229,255,.3)!important;box-shadow:0 0 34px -14px #22e5ff!important;transition:box-shadow .25s,border-color .25s}
[data-design="neon"] [data-store-card]:hover{border-color:#ff2bd6!important;box-shadow:0 0 44px -10px #ff2bd6!important}
.dz-neon-grid{background-image:linear-gradient(rgba(34,229,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(34,229,255,.06) 1px,transparent 1px);background-size:46px 46px;-webkit-mask-image:linear-gradient(#000,transparent 70%);mask-image:linear-gradient(#000,transparent 70%)}
.dz-neon-text{background:linear-gradient(90deg,#8bf0ff,#ff7bea);-webkit-background-clip:text;background-clip:text;color:transparent}
.dz-orb{position:relative;width:min(56vw,250px);aspect-ratio:1}
.dz-orb span{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,#22e5ff,#ff2bd6,#7c3aed,#22e5ff);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 7px),#000 calc(100% - 6px));mask:radial-gradient(farthest-side,transparent calc(100% - 7px),#000 calc(100% - 6px));filter:drop-shadow(0 0 14px #22e5ff);animation:dz-spin 9s linear infinite}
.dz-orb span+span{inset:13%;animation-direction:reverse;animation-duration:6s;filter:drop-shadow(0 0 12px #ff2bd6)}
.dz-orb i{position:absolute;inset:27%;border-radius:50%;background:radial-gradient(circle at 34% 30%,#fff,#9be7ff 18%,#6d28d9 56%,#12082e 100%);box-shadow:0 0 70px 6px rgba(34,229,255,.55),inset -10px -14px 30px rgba(0,0,0,.5)}
`;

const P95 = base("pixel95", { bg: "#3a1262", surface: "#1d0e38", fg: "#f1e9ff", primary: "#b266ff", accent: "#ff66d9", font: "'Courier New',Courier,monospace", radius: "sharp", page: "repeating-conic-gradient(#4a1a7a 0% 25%,#3a1262 0% 50%) 0 0/8px 8px" }) + `
[data-design="pixel95"] [data-store-card]{background:#1d0e38!important;border:2px solid!important;border-color:#8a6ad0 #0a0418 #0a0418 #8a6ad0!important;border-radius:0!important;backdrop-filter:none!important;box-shadow:none!important}
[data-design="pixel95"] *{border-radius:0}
.p95-window{background:#cfc2ea;border:2px solid;border-color:#fff #3a2a5a #3a2a5a #fff;box-shadow:2px 2px 0 #000;color:#1b1030}
.p95-title{display:flex;align-items:center;gap:8px;padding:3px 6px;background:linear-gradient(90deg,#2a0a5e,#8a45e0);color:#fff;font-weight:700;font-size:13px}
.p95-btn{width:18px;height:16px;display:grid;place-items:center;background:#cfc2ea;border:2px solid;border-color:#fff #3a2a5a #3a2a5a #fff;color:#000;font-size:10px;line-height:1}
.p95-menu{display:flex;flex-wrap:wrap;gap:2px;padding:2px 4px;border-bottom:1px solid #8a7aab;font-size:12px}
.p95-menu-item{padding:2px 8px;color:#1b1030}.p95-menu-item:hover{background:#2a0a5e;color:#fff}
.p95-body{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;padding:10px}
@media(min-width:768px){.p95-body{grid-template-columns:200px minmax(0,1fr)}}
.p95-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.p95-folder{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:2px solid transparent;font-size:13px;color:#1b1030;text-align:left}
.p95-folder:hover{border-color:#8a7aab}.p95-folder.is-on{background:#2a0a5e;color:#fff}
.p95-inset{border:2px solid;border-color:#3a2a5a #fff #fff #3a2a5a;background:#e8def8;padding:10px;color:#1b1030}
.p95-main{min-width:0;background:#120826;border:2px solid;border-color:#3a2a5a #fff #fff #3a2a5a;padding:10px;color:#f1e9ff}
.p95-main .p95-label{color:#d6c4ff}
.p95-button{padding:6px 14px;background:#cfc2ea;border:2px solid;border-color:#fff #3a2a5a #3a2a5a #fff;font-weight:700;font-size:12px;color:#000}
.p95-button:active{border-color:#3a2a5a #fff #fff #3a2a5a}
.p95-status{display:flex;justify-content:space-between;gap:8px;padding:2px 8px;border-top:2px solid #fff;font-size:11px}
.p95-taskbar{position:fixed;left:0;right:0;bottom:0;z-index:60;display:flex;align-items:center;gap:6px;height:46px;padding:4px 92px 4px 6px;background:#cfc2ea;border-top:2px solid #fff;color:#000;font-size:12px;font-weight:700}
.p95-task,.p95-start{display:flex;align-items:center;gap:6px;padding:3px 10px;background:#cfc2ea;border:2px solid;border-color:#fff #3a2a5a #3a2a5a #fff;color:#000;height:34px}
.p95-task.is-on{border-color:#3a2a5a #fff #fff #3a2a5a;background:#e8def8}
.p95-start{padding:0 2px;border-color:#fff #3a2a5a #3a2a5a #fff}
.p95-start{gap:2px}
.p95-start button,.p95-start a{background:#cfc2ea!important;color:#000!important;border:2px solid!important;border-color:#fff #3a2a5a #3a2a5a #fff!important;border-radius:0!important;padding:2px 8px!important;font-size:12px!important;min-height:0}
.p95-start svg{color:#000!important}
.dz-p95 .fixed.bottom-6{bottom:56px!important;right:10px!important;z-index:70}
.p95-tray{margin-left:auto;border:2px solid;border-color:#3a2a5a #fff #fff #3a2a5a;padding:6px 10px}
`;

const EDIT = base("editorial", { bg: "#2a3320", surface: "#323d26", fg: "#f1ecd9", primary: "#cdd9a0", accent: "#d9c98a", font: "ui-serif,Georgia,'Times New Roman',serif", radius: "soft", page: "radial-gradient(70% 45% at 85% 0%,rgba(205,217,160,.14),transparent 70%),#2a3320" }) + `
[data-design="editorial"] [data-store-card]{background:#323d26!important;border:1px solid rgba(241,236,217,.28)!important;border-radius:1.25rem!important;backdrop-filter:none!important;box-shadow:none!important}
[data-design="editorial"] [data-store-card]:hover{border-color:#d9c98a!important}
.dz-serif{font-family:ui-serif,Georgia,'Times New Roman',serif}
`;

const GLASS = base("floatglass", { bg: "#150a33", surface: "#24145a", fg: "#f5f0ff", primary: "#8b5cf6", accent: "#c084fc", font: "ui-rounded,'SF Pro Rounded',Nunito,'Trebuchet MS',system-ui,sans-serif", radius: "pill", page: "linear-gradient(160deg,#150a33 0%,#2a1566 55%,#4b25b8 100%)" }) + `
[data-design="floatglass"] [data-store-card]{background:rgba(255,255,255,.08)!important;border:1px solid rgba(255,255,255,.22)!important;backdrop-filter:blur(18px)!important;border-radius:2rem!important;box-shadow:0 24px 50px -24px rgba(0,0,0,.6)!important}
.dz-blob{position:fixed;border-radius:50%;filter:blur(90px);opacity:.5;pointer-events:none;animation:dz-drift 16s ease-in-out infinite}
.dz-blob-a{top:-100px;right:-80px;width:380px;height:380px;background:#8b5cf6}
.dz-blob-b{bottom:-120px;left:18%;width:340px;height:340px;background:#ec4899;animation-delay:-6s}
`;

const BY: Record<Exclude<DesignId, "classic">, string> = { folio: FOLIO, neon: NEON, pixel95: P95, editorial: EDIT, floatglass: GLASS };
export const designCss = (id: Exclude<DesignId, "classic">) => COMMON + (BY[id] ?? "");
