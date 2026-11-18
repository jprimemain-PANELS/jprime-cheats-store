/** Store designs: whole-page layouts the OWNER assigns per store. "classic" is today's look (default, never changes). Pure data, safe on server and client. */
export const DESIGNS = [
  { id: "classic", name: "Midnight Violet (current)", blurb: "The original JPRIME look: top bar, glowing violet hero, 3-column cards." },
  { id: "folio", name: "Folio", blurb: "Dark portfolio style, giant headline, orange accent, numbered category list." },
  { id: "neon", name: "Neon Core", blurb: "Futuristic neon hero with a glowing orb, floating pill menu, glass cards." },
  { id: "pixel95", name: "Pixel 95", blurb: "Retro Windows-95 desktop: windows, title bars, taskbar at the bottom." },
  { id: "editorial", name: "Olive Editorial", blurb: "Magazine style: olive green, big serif headline, pill menu, index rows." },
  { id: "floatglass", name: "Float Glass", blurb: "Soft purple glass: left dock menu, floating widgets, big rounded cards." },
] as const;
export type DesignId = (typeof DESIGNS)[number]["id"];
export const DESIGN_IDS: string[] = DESIGNS.map((d) => d.id);
export const isDesignId = (v: unknown): v is DesignId => typeof v === "string" && DESIGN_IDS.includes(v);
export const cleanDesign = (v: unknown): DesignId => (isDesignId(v) ? v : "classic");
