import type { DesignId } from "@/lib/store-designs";

/**
 * Different PAGE ARCHITECTURE per design for the login, profile and wallet screens (not only colours).
 * Pure CSS on stable hooks: login root [data-login-card][data-brand], profile [data-pf-*], wallet = the dialog.
 * Every rule is scoped to html[data-design="id"], so the classic look is never touched.
 */
type LoginKind = "split" | "splitr" | "rail" | "glass" | "term";
type ProfileKind = "side" | "banner" | "dash" | "num";
type WalletKind = "center" | "sheet" | "drawer" | "ticket";
type Spec = { login: LoginKind; profile: ProfileKind; wallet: WalletKind };

const SPEC: Record<Exclude<DesignId, "classic">, Spec> = {
  folio: { login: "splitr", profile: "side", wallet: "center" },
  neon: { login: "glass", profile: "dash", wallet: "sheet" },
  editorial: { login: "split", profile: "banner", wallet: "ticket" },
  floatglass: { login: "glass", profile: "dash", wallet: "center" },
  arena: { login: "rail", profile: "num", wallet: "drawer" },
  console: { login: "term", profile: "dash", wallet: "ticket" },
  retrowave: { login: "glass", profile: "dash", wallet: "sheet" },
  travel: { login: "split", profile: "side", wallet: "drawer" },
  lime: { login: "splitr", profile: "banner", wallet: "center" },
  midnight: { login: "glass", profile: "banner", wallet: "sheet" },
  blackridge: { login: "rail", profile: "side", wallet: "drawer" },
  tidewell: { login: "glass", profile: "dash", wallet: "sheet" },
  coraltide: { login: "split", profile: "dash", wallet: "center" },
  mossgrove: { login: "glass", profile: "dash", wallet: "sheet" },
  forest: { login: "splitr", profile: "side", wallet: "drawer" },
  crimson: { login: "rail", profile: "num", wallet: "drawer" },
  serene: { login: "glass", profile: "banner", wallet: "center" },
};

const LOGIN_BASE = (s: string) => `
${s} [data-login-card]>div.pointer-events-none,${s} [data-login-card] canvas{display:none!important}
${s} [data-login-card] .card-wrap > *:not(.login-panel){display:none!important}
${s} [data-login-card] .card-wrap{margin-top:0!important}
${s} [data-login-card] .lg-title,${s} [data-login-card] .lg-title span,${s} [data-login-card] h1{background:none!important;-webkit-text-fill-color:var(--store-fg)!important;color:var(--store-fg)!important}
${s} [data-login-card] .login-panel p,${s} [data-login-card] .login-panel label,${s} [data-login-card] .login-panel input{color:var(--store-fg)!important}
${s} [data-login-card] .login-panel input::placeholder{color:color-mix(in srgb,var(--store-fg) 50%,transparent)!important}
${s} [data-login-card] .lg-field{background:var(--store-surface)!important;border:1px solid var(--store-line)!important}
${s} [data-login-card] .lg-switch{background:var(--store-surface)!important;border:1px solid var(--store-line)!important}
${s} [data-login-card] .lg-field *{background-color:transparent!important}
${s} [data-login-card] .lg-switch>span{color:var(--store-fg)!important}`;

function login(kind: LoginKind, S: string): string {
  const R = `html[data-design]`; void R;
  const root = `${S} [data-login-card]`;
  const flat = `${root} .login-panel{background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;border-radius:0!important}${root} .lg-inner{background:transparent!important;border:0!important;box-shadow:none!important}`;
  switch (kind) {
    case "split":
    case "splitr":
      return `${LOGIN_BASE(S)}${flat}
${root}::before{content:attr(data-brand);align-self:stretch;margin:-2.5rem -1rem 1.5rem;padding:1.2rem 1rem;background:var(--store-primary);color:var(--store-on);font-weight:900;text-transform:uppercase;font-size:1.6rem;line-height:1;letter-spacing:-.02em;word-break:break-word;position:relative;z-index:2}
@media(min-width:900px){
 ${root}{flex-direction:${kind === "split" ? "row" : "row-reverse"}!important;padding:0!important;align-items:stretch!important;justify-content:stretch!important}
 ${root}::before{margin:0;flex:1 1 50%;align-self:stretch;display:flex;align-items:center;padding:3rem;font-size:clamp(3rem,6.5vw,6.5rem);justify-content:flex-start}
 ${root}>main{flex:1 1 50%;max-width:none!important;display:flex!important;align-items:center;justify-content:center;padding:3rem}
 ${root} .card-wrap{width:100%;max-width:26rem}
}`;
    case "rail":
      return `${LOGIN_BASE(S)}
${root} .login-panel{background:transparent!important;border:0!important;border-left:4px solid var(--store-primary)!important;border-radius:0!important;box-shadow:none!important;backdrop-filter:none!important}
${root} .lg-inner{background:transparent!important;border:0!important}
${root}::after{content:attr(data-brand);position:absolute;right:1.5vw;top:50%;transform:translateY(-50%);writing-mode:vertical-rl;max-height:92%;overflow:hidden;white-space:nowrap;font-size:clamp(4rem,11vw,9rem);font-weight:900;text-transform:uppercase;color:transparent;-webkit-text-stroke:1px var(--store-line);opacity:.6;pointer-events:none;display:none}
@media(min-width:760px){${root}{align-items:flex-start!important;padding-left:clamp(1rem,9vw,8rem)!important}${root}::after{display:block}${root}>main{max-width:27rem!important}}`;
    case "glass":
      return `${LOGIN_BASE(S)}
${root}::before{content:"";position:absolute;left:50%;top:50%;width:min(80vw,560px);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,var(--store-primary),transparent 66%);opacity:.32;filter:blur(46px);pointer-events:none}
${root} .login-panel{border-radius:2rem!important;background:color-mix(in srgb,var(--store-fg) 8%,transparent)!important;border:1px solid color-mix(in srgb,var(--store-fg) 22%,transparent)!important;backdrop-filter:blur(22px)!important;box-shadow:0 40px 90px -30px rgba(0,0,0,.5)!important}
${root} .lg-inner{background:transparent!important;border-color:transparent!important}
${root}>main{max-width:25rem!important}`;
    case "term":
      return `${LOGIN_BASE(S)}
${root}{justify-content:flex-start!important;padding-top:min(12vh,6rem)!important}
${root}::before{content:"▌ " attr(data-brand) " :: sign in";position:absolute;top:0;left:0;right:0;padding:.75rem 1rem;border-bottom:1px solid var(--store-line);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--store-primary);background:color-mix(in srgb,var(--store-surface) 80%,transparent);z-index:3}
${root} .login-panel{border-radius:0!important;border:1px solid var(--store-line)!important;border-top:3px solid var(--store-primary)!important;background:var(--store-surface)!important;box-shadow:8px 8px 0 color-mix(in srgb,var(--store-primary) 35%,transparent)!important;backdrop-filter:none!important}
${root} .lg-inner{background:transparent!important;border:0!important;border-radius:0!important}
${root}>main{max-width:34rem!important}`;
  }
}

function profile(kind: ProfileKind, S: string): string {
  const W = `${S} [data-pf-wrap]`;
  const kids = `${W}>*{margin:0!important}`;
  switch (kind) {
    case "side":
      return `@media(min-width:1024px){
 ${W}{max-width:72rem!important;display:grid!important;grid-template-columns:340px minmax(0,1fr);gap:1.25rem;align-items:start}
 ${kids}
 ${W}>button{grid-column:1/-1}
 ${W}>[data-pf-hero],${W}>[data-pf-upgrade],${W}>[data-pf-pass]{grid-column:1}
 ${W}>[data-pf-hist]{grid-column:2;grid-row:2/span 4}
 ${W}>[data-pf-hero]{position:sticky;top:1rem}
}`;
    case "banner":
      return `${W}{max-width:40rem!important}
${S} [data-pf-hero]{text-align:center;background:linear-gradient(135deg,var(--store-primary),var(--store-accent))!important;border:0!important;padding:2rem 1.25rem!important}
${S} [data-pf-hero] > div:first-child{flex-direction:column;gap:.75rem}
${S} [data-pf-hero] > div:first-child > div:first-child{width:5.5rem!important;height:5.5rem!important;font-size:2.2rem!important;background:var(--store-surface)!important;color:var(--store-fg)!important}
${S} [data-pf-hero] h1,${S} [data-pf-hero] p,${S} [data-pf-hero] span{color:var(--store-on)!important;border-color:transparent}
${S} [data-pf-hero] > div:last-child > div{background:color-mix(in srgb,var(--store-bg) 35%,transparent)!important}
${S} [data-pf-hero] > div:last-child svg,${S} [data-pf-hero] > div:last-child p{color:var(--store-on)!important}`;
    case "dash":
      return `@media(min-width:900px){
 ${W}{max-width:64rem!important;display:grid!important;grid-template-columns:1fr 1fr;gap:1.25rem;align-items:start}
 ${kids}
 ${W}>button,${W}>[data-pf-hero],${W}>[data-pf-upgrade]{grid-column:1/-1}
 ${W}>[data-pf-pass]{grid-column:1}
 ${W}>[data-pf-hist]{grid-column:2;grid-row:3/span 2}
}
${S} [data-pf-hero] > div:last-child > div{padding:1.1rem .5rem!important;border:1px solid var(--store-line)}`;
    case "num":
      return `${W}{max-width:46rem!important;counter-reset:pf}
${W}>section{position:relative;border-radius:0!important;border-left:4px solid var(--store-primary)!important;counter-increment:pf;padding-right:4.5rem!important}
${W}>section::after{content:"0" counter(pf);position:absolute;right:1rem;top:.4rem;font-size:3rem;font-weight:900;line-height:1;color:transparent;-webkit-text-stroke:1px var(--store-primary);opacity:.55}`;
  }
}

function wallet(kind: WalletKind, S: string): string {
  const C = `${S} [data-slot="dialog-content"]`;
  switch (kind) {
    case "center":
      return `${C}{border-radius:1.75rem!important}`;
    case "ticket":
      return `${C}{border-radius:0!important;border:2px solid var(--store-primary)!important;box-shadow:8px 8px 0 color-mix(in srgb,var(--store-primary) 40%,transparent)!important}`;
    case "sheet":
      return `@keyframes dz-sheet{from{transform:translateY(100%)}to{transform:none}}
${C}{top:auto!important;bottom:0!important;left:0!important;right:0!important;transform:none!important;translate:none!important;width:100%!important;max-width:none!important;border-radius:28px 28px 0 0!important;animation:dz-sheet .3s ease-out both!important}
@media(min-width:640px){${C}{left:50%!important;right:auto!important;transform:none!important;translate:-50% 0!important;max-width:30rem!important;animation:none!important}}`;
    case "drawer":
      return `@keyframes dz-drawer{from{transform:translateX(100%)}to{transform:none}}
${C}{top:0!important;bottom:0!important;right:0!important;left:auto!important;transform:none!important;translate:none!important;height:100vh!important;max-height:100vh!important;width:min(440px,100%)!important;max-width:none!important;border-radius:0!important;animation:dz-drawer .3s ease-out both!important}`;
  }
}

export function pageLayoutCss(id: DesignId): string {
  if (id === "classic") return "";
  const spec = SPEC[id];
  if (!spec) return "";
  const S = `html[data-design="${id}"]`;
  return login(spec.login, S) + profile(spec.profile, S) + wallet(spec.wallet, S);
}
