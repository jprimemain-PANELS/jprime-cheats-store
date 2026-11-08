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
};

export const PRESETS: Record<string, Pick<Theme, "primary" | "accent" | "background" | "surface" | "foreground">> = {
  violet: { primary: "#8b5cf6", accent: "#d946ef", background: "#07040f", surface: "#0b0714", foreground: "#f4f4f5" },
  ocean: { primary: "#0ea5e9", accent: "#22d3ee", background: "#04101a", surface: "#071a29", foreground: "#f0f9ff" },
  emerald: { primary: "#10b981", accent: "#a3e635", background: "#041310", surface: "#08201a", foreground: "#ecfdf5" },
  sunset: { primary: "#f97316", accent: "#f43f5e", background: "#130806", surface: "#1d0d09", foreground: "#fff7ed" },
  light: { primary: "#4f46e5", accent: "#db2777", background: "#f8fafc", surface: "#ffffff", foreground: "#0f172a" },
  mono: { primary: "#e4e4e7", accent: "#a1a1aa", background: "#09090b", surface: "#131316", foreground: "#fafafa" },
};

export const DEFAULT_THEME: Theme = {
  preset: "violet",
  ...PRESETS.violet,
  font: "default",
  logoUrl: "",
  tagline: "",
  announcement: "",
  footerText: "",
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
    Object.assign(t, PRESETS[src.preset], { preset: src.preset });
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
  return [
    ":root{",
    `--store-primary:${t.primary};--store-accent:${t.accent};--store-bg:${t.background};--store-surface:${t.surface};--store-fg:${t.foreground};`,
    `--font-sans:${FONTS[t.font].stack};`,
    scale("violet", t.primary) + ";",
    scale("fuchsia", t.accent) + ";",
    `--background:${t.background};--foreground:${t.foreground};--card:${t.surface};--card-foreground:${t.foreground};`,
    `--popover:${t.surface};--popover-foreground:${t.foreground};--primary:${t.primary};--accent:${t.accent};--ring:${t.primary};`,
    `color-scheme:${dark ? "dark" : "light"};`,
    "}",
    `body{background:${t.background};color:${t.foreground};font-family:${FONTS[t.font].stack}}`,
    `.bg-\\[\\#07040f\\]{background-color:var(--store-bg)!important}`,
    `.bg-\\[\\#0b0714\\]{background-color:var(--store-surface)!important}`,
    `.text-white,.text-zinc-100,.text-zinc-200{color:var(--store-fg)!important}`,
  ].join("");
}
