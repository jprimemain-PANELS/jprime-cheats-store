/** Plain (server + client safe) brand type and the owner store's default brand. */
export type Brand = {
  name: string;
  isOwner: boolean;
  telegram: string | null;
  logoUrl: string;
  tagline: string;
  announcement: string;
  footerText: string;
};

export const OWNER_BRAND: Brand = {
  name: "JPRIME CHEATS", isOwner: true, telegram: "JPRIMEADMIN", logoUrl: "", tagline: "", announcement: "", footerText: "",
};
