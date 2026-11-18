/** Plain (server + client safe) brand type and the owner store's default brand. */
export type BrandLayout = {
  heroLayout: "centered" | "left" | "split"; heroTitle: string; heroSubtitle: string; heroImageUrl: string; loginCharacterUrl: string; loginPetUrl: string; loginCard: string; loginBg: string;
  ctaText: string; columns: 2 | 3 | 4; showStats: boolean;
};
export const DEFAULT_LAYOUT: BrandLayout = { heroLayout: "centered", heroTitle: "", heroSubtitle: "", heroImageUrl: "", loginCharacterUrl: "", loginPetUrl: "", loginCard: "original", loginBg: "original", ctaText: "", columns: 3, showStats: true };

export type BrandOptions = { tutorialOn: boolean; tutorialUrl: string; upgradeOn: boolean; upgradePrice: number; resellerLaunch: boolean; design?: string };
export const OWNER_TUTORIAL_URL = "https://youtu.be/F0UKQlnyXE4?si=n6qZtG91u6nddqSa";
export const NO_OPTIONS: BrandOptions = { tutorialOn: false, tutorialUrl: "", upgradeOn: false, upgradePrice: 99, resellerLaunch: false };

export type BrandSocial = { whatsapp: string; instagram: string; youtube: string; floatingChat: boolean };
export const NO_SOCIAL: BrandSocial = { whatsapp: "", instagram: "", youtube: "", floatingChat: false };

export type Brand = {
  social?: BrandSocial;
  options: BrandOptions;
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
  options: { ...NO_OPTIONS, tutorialOn: true, tutorialUrl: OWNER_TUTORIAL_URL },
  name: "JPRIME CHEATS", isOwner: true, telegram: "JPRIMEADMIN", logoUrl: "", tagline: "", announcement: "", footerText: "",
};
