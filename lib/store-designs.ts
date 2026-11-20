/** Store designs: whole-site looks the OWNER assigns per store. "classic" is today's look (default, never changes). Pure data, safe on server and client. */
export const DESIGNS = [
  { id: "classic", name: "Midnight Violet (current)", blurb: "The original JPRIME look: top bar, glowing violet hero, 3-column cards." },
  { id: "folio", name: "Folio", blurb: "Dark portfolio style, giant headline, orange accent, numbered category list." },
  { id: "neon", name: "Neon Core", blurb: "Futuristic neon hero with a glowing orb, floating pill menu, glass cards." },
  { id: "editorial", name: "Olive Editorial", blurb: "Magazine style: olive green, big serif headline, pill menu, index rows." },
  { id: "floatglass", name: "Float Glass", blurb: "Soft purple glass: left dock menu, floating widgets, big rounded cards." },
  { id: "arena", name: "Arena", blurb: "Esports HUD: red + black, slanted headline, angled cut-corner cards, scoreboard stats." },
  { id: "console", name: "Console", blurb: "Clean dashboard: blue navy, left sidebar, KPI tiles, panel-style cards." },
  { id: "retrowave", name: "Retrowave", blurb: "Synthwave sunset: pink and amber sun over a perspective grid, chunky italic type." },
  { id: "travel", name: "Travel Freely", blurb: "Warm ivory + deep teal, giant condensed headline. SIDE SLIDE-OUT MENU (hamburger opens a left drawer)." },
  { id: "lime", name: "Lime Studio", blurb: "Clean ivory with black type and a neon-lime sphere. Outline pills, text nav, split hero." },
  { id: "midnight", name: "Midnight Studio", blurb: "Pure black, centred headline, centred menu, two buttons and a glowing arch below." },
  { id: "blackridge", name: "Blackridge", blurb: "Charcoal + cherry red, light-weight headline, dropdown-style menu, proof strip." },
  { id: "tidewell", name: "Tidewell Ink", blurb: "Ink navy + pearl, glass droplet hero. BOTTOM FLOATING MENU DOCK (categories, wallet, profile)." },
  { id: "coraltide", name: "Coral Tide", blurb: "Cream + coral, centred nav card, wave band, chunky pill buttons." },
  { id: "mossgrove", name: "Mossgrove", blurb: "Deep green glass: floating capsule nav, glowing moss orb, glass stat tiles." },
  { id: "forest", name: "Forest Serif", blurb: "Green + serif headline, split layout with a vertical category rail." },
  { id: "crimson", name: "Crimson Slide", blurb: "Black + red, huge slide numbering, bold uppercase, numbered category tabs." },
  { id: "serene", name: "Serene Sand", blurb: "Warm sand, thin serif headline, vertical numerals, calm text menu." },
] as const;
export type DesignId = (typeof DESIGNS)[number]["id"];
export const DESIGN_IDS: string[] = DESIGNS.map((d) => d.id);
export const isDesignId = (v: unknown): v is DesignId => typeof v === "string" && DESIGN_IDS.includes(v);
export const cleanDesign = (v: unknown): DesignId => (isDesignId(v) ? v : "classic");
