/**
 * Per-store theme: validation + CSS generation. Pure functions (no I/O) so they are safe
 * to use on the server, in tests and in the branding editor preview.
 *
 * SAFETY: a theme is DATA, never CSS or HTML. Colors must be #rrggbb, the font must be one
 * of our fixed stacks, the logo must be an https URL used only as <img src>, and every text
 * field is length-limited plain text rendered through React (escaped). buildThemeCss()
 * only ever interpolates values that passed these checks.
 */

export const FONTS = {
  default: { label: "Default (Geist)", stack: "'Geist','Geist Fallback',ui-sans-serif,system-ui,sans-serif" },
  system: { label: "System", stack: "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" },
  rounded: { label: "Rounded", stack: "ui-rounded,'SF Pro Rounded','Nunito','Trebuchet MS',system-ui,sans-serif" },
  serif: { label: "Serif", stack: "ui-serif,Georgia,'Times New Roman',serif" },
  mono: { label: "Monospace", stack: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" },
} as const;
export type FontKey = keyof typeof FONTS;

export const RADII = { sharp: "sharp", soft: "soft", round: "round", pill: "pill" } as const;
export const CARD_STYLES = ["glass", "solid", "outline", "elevated"] as const;
export const BACKDROPS = ["solid", "gradient", "aurora", "grid", "image"] as const;
export const LOGIN_CARDS = ["original", "glass", "frost", "neon", "minimal", "aurora"] as const;
export const LOGIN_BGS = ["original", "aurora", "particles", "beams", "waves", "stars"] as const;
export const HERO_LAYOUTS = ["centered", "left", "split"] as const;
export const FONT_SCALES = ["small", "normal", "large"] as const;
export const BUTTON_STYLES = ["gradient", "solid"] as const;
export const COLUMNS = [2, 3, 4] as const;
export type Radius = keyof typeof RADII;

export type Theme = {
  preset?: string;
  primary: string;
  accent: string;
  background: string;
  surface: string;
  foreground: string;
  font: FontKey;
  logoUrl: string;
  tagline: string;
  announcement: string;
  footerText: string;
  // ---- v2: structure (every default equals the original look, so old themes render unchanged) ----
  radius: Radius;
  cardStyle: (typeof CARD_STYLES)[number];
  backdrop: (typeof BACKDROPS)[number];
  backdropImageUrl: string;
  heroLayout: (typeof HERO_LAYOUTS)[number];
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  loginCharacterUrl: string;
  loginCard: (typeof LOGIN_CARDS)[number];
  loginBg: (typeof LOGIN_BGS)[number];
  loginPetUrl: string;
  ctaText: string;
  columns: (typeof COLUMNS)[number];
  fontScale: (typeof FONT_SCALES)[number];
  buttonStyle: (typeof BUTTON_STYLES)[number];
  showStats: boolean;
  motion: boolean;
};

type Colors = Pick<Theme, "primary" | "accent" | "background" | "surface" | "foreground">;
export const PRESETS: Record<string, Colors & Partial<Theme>> = {
  violet: { primary: "#8b5cf6", accent: "#d946ef", background: "#07040f", surface: "#0b0714", foreground: "#f4f4f5" },
  ocean: { primary: "#0ea5e9", accent: "#22d3ee", background: "#04101a", surface: "#071a29", foreground: "#f0f9ff" },
  emerald: { primary: "#10b981", accent: "#a3e635", background: "#041310", surface: "#08201a", foreground: "#ecfdf5" },
  sunset: { primary: "#f97316", accent: "#f43f5e", background: "#130806", surface: "#1d0d09", foreground: "#fff7ed" },
  light: { primary: "#4f46e5", accent: "#db2777", background: "#f8fafc", surface: "#ffffff", foreground: "#0f172a" },
  mono: { primary: "#e4e4e7", accent: "#a1a1aa", background: "#09090b", surface: "#131316", foreground: "#fafafa" },
  // v2 presets also change the layout, not just colors
  arcade: { primary: "#22d3ee", accent: "#a3e635", background: "#05070d", surface: "#0b1220", foreground: "#e6fffb", radius: "sharp", cardStyle: "outline", backdrop: "grid", heroLayout: "left", columns: 4, font: "mono", buttonStyle: "solid", showStats: false },
  boutique: { primary: "#b45309", accent: "#be123c", background: "#fbf7f0", surface: "#ffffff", foreground: "#1c1917", radius: "soft", cardStyle: "elevated", backdrop: "solid", heroLayout: "split", columns: 3, font: "serif", buttonStyle: "solid", fontScale: "large" },
  neon: { primary: "#f43f5e", accent: "#8b5cf6", background: "#0a0510", surface: "#140a1f", foreground: "#fdf4ff", radius: "pill", cardStyle: "glass", backdrop: "aurora", heroLayout: "centered", columns: 3, font: "rounded" },
  slate: { primary: "#38bdf8", accent: "#38bdf8", background: "#0f172a", surface: "#1e293b", foreground: "#f1f5f9", radius: "soft", cardStyle: "solid", backdrop: "gradient", heroLayout: "left", columns: 2, font: "system", buttonStyle: "solid", motion: false },
};

export const DEFAULT_THEME: Theme = {
  preset: "violet",
  ...PRESETS.violet,
  font: "default",
  logoUrl: "",
  tagline: "",
  announcement: "",
  footerText: "",
  radius: "round",
  cardStyle: "glass",
  backdrop: "solid",
  backdropImageUrl: "",
  heroLayout: "centered",
  heroTitle: "",
  heroSubtitle: "",
  heroImageUrl: "",
  loginCharacterUrl: "",
  loginCard: "original",
  loginBg: "original",
  loginPetUrl: "",
  ctaText: "",
  columns: 3,
  fontScale: "normal",
  buttonStyle: "gradient",
  showStats: true,
  motion: true,
};

export const STRUCTURE_DEFAULTS: Partial<Theme> = {
  radius: DEFAULT_THEME.radius, cardStyle: DEFAULT_THEME.cardStyle, backdrop: DEFAULT_THEME.backdrop, heroLayout: DEFAULT_THEME.heroLayout,
  columns: DEFAULT_THEME.columns, fontScale: DEFAULT_THEME.fontScale, buttonStyle: DEFAULT_THEME.buttonStyle,
  showStats: DEFAULT_THEME.showStats, motion: DEFAULT_THEME.motion, font: DEFAULT_THEME.font,
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Plain text only: no control characters, no angle brackets, trimmed and length-limited. */
function cleanText(v: unknown, max: number): string {
  return String(v ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function isSafeLogoUrl(raw: string): boolean {
  if (!raw) return true;
  if (raw.length > 400 || /[\s"'()<>\\]/.test(raw)) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}

export type ThemeResult = { ok: true; theme: Theme } | { ok: false; error: string };

/** Validate untrusted input into a full Theme. Unknown keys are dropped. Missing keys use the base. */
export function validateTheme(input: unknown, base: Theme = DEFAULT_THEME): ThemeResult {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const t: Theme = { ...base };

  if (typeof src.preset === "string" && src.preset in PRESETS && !("primary" in src)) {
    // a preset resets structure to the defaults first, then applies its own choices
    Object.assign(t, STRUCTURE_DEFAULTS, PRESETS[src.preset], { preset: src.preset });
  }
  for (const k of ["primary", "accent", "background", "surface", "foreground"] as const) {
    if (src[k] === undefined) continue;
    const v = String(src[k]).trim();
    if (!HEX.test(v)) return { ok: false, error: `${k} must be a color like #8b5cf6.` };
    t[k] = v.toLowerCase();
    t.preset = typeof src.preset === "string" && src.preset in PRESETS ? src.preset : "custom";
  }
  if (src.font !== undefined) {
    if (typeof src.font !== "string" || !(src.font in FONTS)) return { ok: false, error: "Unsupported font." };
    t.font = src.font as FontKey;
  }
  if (src.logoUrl !== undefined) {
    const u = String(src.logoUrl).trim();
    if (!isSafeLogoUrl(u)) return { ok: false, error: "Logo must be a plain https:// image link." };
    t.logoUrl = u;
  }
  const pick = <T extends readonly (string | number)[]>(key: string, list: T, label: string): T[number] | undefined | "bad" => {
    if (src[key] === undefined) return undefined;
    return (list as readonly unknown[]).includes(src[key]) ? (src[key] as T[number]) : "bad";
  };
  const enums: [keyof Theme, readonly (string | number)[], string][] = [
    ["radius", Object.keys(RADII), "corner style"], ["cardStyle", CARD_STYLES, "card style"], ["backdrop", BACKDROPS, "background style"],
    ["heroLayout", HERO_LAYOUTS, "header layout"], ["columns", COLUMNS, "columns"], ["fontScale", FONT_SCALES, "text size"],
    ["buttonStyle", BUTTON_STYLES, "button style"], ["loginCard", LOGIN_CARDS, "login card"], ["loginBg", LOGIN_BGS, "login background"],
  ];
  for (const [k, list, label] of enums) {
    const v = pick(k as string, list, label);
    if (v === "bad") return { ok: false, error: `Unsupported ${label}.` };
    if (v !== undefined) (t as any)[k] = v;
  }
  for (const k of ["showStats", "motion"] as const) {
    if (src[k] === undefined) continue;
    if (typeof src[k] !== "boolean") return { ok: false, error: "Invalid switch value." };
    t[k] = src[k] as boolean;
  }
  for (const k of ["backdropImageUrl", "heroImageUrl", "loginCharacterUrl", "loginPetUrl"] as const) {
    if (src[k] === undefined) continue;
    const u = String(src[k]).trim();
    if (!isSafeLogoUrl(u)) return { ok: false, error: "Image must be a plain https:// link." };
    t[k] = u;
  }
  if (t.backdrop === "image" && !t.backdropImageUrl) t.backdrop = "solid";
  if (src.heroTitle !== undefined) t.heroTitle = cleanText(src.heroTitle, 60);
  if (src.heroSubtitle !== undefined) t.heroSubtitle = cleanText(src.heroSubtitle, 200);
  if (src.ctaText !== undefined) t.ctaText = cleanText(src.ctaText, 24);
  if (src.tagline !== undefined) t.tagline = cleanText(src.tagline, 120);
  if (src.announcement !== undefined) t.announcement = cleanText(src.announcement, 200);
  if (src.footerText !== undefined) t.footerText = cleanText(src.footerText, 200);

  if (contrastRatio(t.foreground, t.background) < 4) {
    return { ok: false, error: "Text color is too close to the background color. Pick colors that are easier to read." };
  }
  if (contrastRatio(t.primary, t.background) < 1.8) {
    return { ok: false, error: "Primary color is too close to the background color." };
  }
  return { ok: true, theme: t };
}

/** Re-validate a stored value (never trust the DB blindly either); falls back to the default. */
export function themeFromStored(stored: unknown): Theme {
  const r = validateTheme(stored, DEFAULT_THEME);
  return r.ok ? r.theme : DEFAULT_THEME;
}

/**
 * CSS for one store. Only validated values are interpolated. The site's accent classes are Tailwind
 * palette colors (violet/fuchsia), so overriding those variables re-colors the whole UI at once; the
 * two fixed page backgrounds and white text are matched by their utility classes.
 */
export function buildThemeCss(theme: Theme): string {
  const t = themeFromStored(theme);
  const mix = (c: string, pct: number, withC: string) => `color-mix(in srgb, ${c} ${pct}%, ${withC})`;
  const scale = (name: string, v: string) =>
    [
      `--color-${name}-200:${mix(v, 35, "#fff")}`,
      `--color-${name}-300:${mix(v, 55, "#fff")}`,
      `--color-${name}-400:${mix(v, 78, "#fff")}`,
      `--color-${name}-500:${v}`,
      `--color-${name}-600:${mix(v, 86, "#000")}`,
      `--color-${name}-700:${mix(v, 68, "#000")}`,
    ].join(";");
  const dark = luminance(t.background) < 0.4;
  const accentColor = t.buttonStyle === "solid" ? t.primary : t.accent;
  const RADIUS_VARS: Record<Radius, string> = {
    round: "",
    soft: "--radius-md:6px;--radius-lg:8px;--radius-xl:10px;--radius-2xl:12px;--radius-3xl:14px;",
    pill: "--radius-lg:1rem;--radius-xl:1.25rem;--radius-2xl:1.75rem;--radius-3xl:2.25rem;",
    sharp: "--radius-md:0;--radius-lg:0;--radius-xl:0;--radius-2xl:0;--radius-3xl:0;--radius-full:2px;",
  };
  const SCALE = { small: "14px", normal: "", large: "17px" } as const;
  const line = mix(t.foreground, 7, "transparent");
  const BACKDROP_CSS: Record<string, string> = {
    solid: "",
    gradient: `background-image:linear-gradient(160deg,${t.background} 0%,${mix(t.primary, 24, t.background)} 100%)!important;background-attachment:fixed;`,
    aurora: `background-image:radial-gradient(60% 50% at 12% 8%,${mix(t.primary, 34, "transparent")},transparent 70%),radial-gradient(55% 45% at 92% 20%,${mix(accentColor, 28, "transparent")},transparent 70%),radial-gradient(60% 50% at 50% 100%,${mix(t.primary, 20, "transparent")},transparent 70%)!important;background-attachment:fixed;`,
    grid: `background-image:linear-gradient(${line} 1px,transparent 1px),linear-gradient(90deg,${line} 1px,transparent 1px)!important;background-size:44px 44px;`,
    image: t.backdropImageUrl
      ? `background-image:linear-gradient(${mix(t.background, 84, "transparent")},${mix(t.background, 84, "transparent")}),url("${t.backdropImageUrl}")!important;background-size:cover;background-position:center;background-attachment:fixed;`
      : "",
  };
  const CARD_CSS: Record<string, string> = {
    glass: "",
    solid: `[data-store-card]{background:var(--store-surface)!important;backdrop-filter:none!important;border-color:${mix(t.foreground, 12, "transparent")}!important}`,
    outline: `[data-store-card]{background:transparent!important;backdrop-filter:none!important;border:2px solid ${mix(t.primary, 60, "transparent")}!important}`,
    elevated: `[data-store-card]{background:var(--store-surface)!important;backdrop-filter:none!important;border-color:transparent!important;box-shadow:0 20px 44px -20px rgba(0,0,0,.55)!important}`,
  };
  return [
    ":root{",
    `--store-primary:${t.primary};--store-accent:${accentColor};--store-bg:${t.background};--store-surface:${t.surface};--store-fg:${t.foreground};`,
    `--font-sans:${FONTS[t.font].stack};`,
    scale("violet", t.primary) + ";",
    scale("fuchsia", accentColor) + ";",
    RADIUS_VARS[t.radius],
    `--background:${t.background};--foreground:${t.foreground};--card:${t.surface};--card-foreground:${t.foreground};`,
    `--popover:${t.surface};--popover-foreground:${t.foreground};--primary:${t.primary};--accent:${accentColor};--ring:${t.primary};`,
    `color-scheme:${dark ? "dark" : "light"};`,
    "}",
    `body{background:${t.background};color:${t.foreground};font-family:${FONTS[t.font].stack}}`,
    SCALE[t.fontScale] ? `html{font-size:${SCALE[t.fontScale]}}` : "",
    `.bg-\\[\\#07040f\\]{background-color:var(--store-bg)!important;${BACKDROP_CSS[t.backdrop] ?? ""}}`,
    CARD_CSS[t.cardStyle] ?? "",
    t.motion ? "" : "*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}",
    `.bg-\\[\\#0b0714\\]{background-color:var(--store-surface)!important}`,
    `.text-white,.text-zinc-100,.text-zinc-200{color:var(--store-fg)!important}`,
  ].join("");
}
