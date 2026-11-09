/** Plain (server + client safe) brand type and the owner store's default brand. */
export type BrandLayout = {
  heroLayout: "centered" | "left" | "split"; heroTitle: string; heroSubtitle: string; heroImageUrl: string;
  ctaText: string; columns: 2 | 3 | 4; showStats: boolean;
};
export const DEFAULT_LAYOUT: BrandLayout = { heroLayout: "centered", heroTitle: "", heroSubtitle: "", heroImageUrl: "", ctaText: "", columns: 3, showStats: true };

export type Brand = {
  layout: BrandLayout;
  name: string;
  isOwner: boolean;
  telegram: string | null;
  logoUrl: string;
  tagline: string;
  announcement: string;
  footerText: string;
};

export const OWNER_BRAND: Brand = { layout: DEFAULT_LAYOUT,
  name: "JPRIME CHEATS", isOwner: true, telegram: "JPRIMEADMIN", logoUrl: "", tagline: "", announcement: "", footerText: "",
};
