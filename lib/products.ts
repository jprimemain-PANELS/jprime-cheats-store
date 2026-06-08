export interface PriceTier {
  duration: string;
  priceINR: string;
  resellerPrice?: string;
  priceUSD?: string;
}

export interface Product {
  id: string;
  name: string;
  category: "mobile" | "pc" | "ios";
  prices: PriceTier[];
  updateChannel: string;
  features: string[];
  videoPlaceholder?: string;
  videoUrl?: string;
}

export const mobileProducts: Product[] = [
  {
    id: "drip-client-non-root",
    name: "DRIP CLIENT NON ROOT MOBILE",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/DRIP%20CLIENT%20NON%20ROOT%20MOBILE.mp4",
    category: "mobile",
    prices: [
      { duration: "1 day", priceINR: "₹95", resellerPrice: "₹49", priceUSD: "$1.38" },
      { duration: "3 day", priceINR: "₹185", resellerPrice: "₹79",priceUSD: "$2.20" },
      { duration: "7 day", priceINR: "₹349", resellerPrice: "₹149",priceUSD: "$3.75" },
      { duration: "15 day", priceINR: "₹640", resellerPrice: "₹249",priceUSD: "$6.90" },
      { duration: "31 day", priceINR: "₹899", resellerPrice: "₹349",priceUSD: "$9.80" },
    ],
    updateChannel: "https://t.me/+JNLfa2pGuYxlNWNl",
    features: ["ᴀɪᴍ ᴋɪʟʟ ᴄᴏᴠᴇʀ","ᴀɪᴍ ᴍᴀɢɴᴇᴛ","ꜱɪʟᴇɴᴛ ᴀɪᴍ","ᴀɪᴍʙᴏᴛ ʟᴇɢɪᴛ","ꜱᴘᴇᴇᴅ ᴛɪᴍᴇʀ","ɢʜᴏꜱᴛ ʜᴀᴄᴋ","ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ","🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ","ɴᴏɴ ʀᴏᴏᴛ ᴍᴏʙɪʟᴇ","ʀᴀɴᴋ ᴘᴜꜱʜ ᴘᴜʀᴘᴏꜱᴇ"],
  },
  {
    id: "drip-client-root",
    name: "DRIP CLIENT ROOT MOBILE ( MAIN ID )",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/DRIP%20CLIENT%20NON%20ROOT%20MOBILE.mp4",
    category: "mobile",
    prices: [
      { duration: "1 day", priceINR: "₹98", resellerPrice: "₹55",priceUSD: "$1.40" },
      { duration: "7 day", priceINR: "₹349", resellerPrice: "₹155",priceUSD: "$3.75" },
      { duration: "31 day", priceINR: "₹899", resellerPrice: "₹355",priceUSD: "$9.80" },
    ],
    updateChannel: "https://t.me/+JNLfa2pGuYxlNWNl",
    features: ["ʜᴇᴀᴅꜱʜᴏᴛ","ᴀɪᴍ ᴍᴀɢɴᴇᴛ","ꜱɪʟᴇɴᴛ ᴀɪᴍ","ᴀɪᴍʙᴏᴛ ʟᴇɢɪᴛ","ꜱᴘᴇᴇᴅ ᴛɪᴍᴇʀ","ɢʜᴏꜱᴛ ʜᴀᴄᴋ","ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ","🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ","ʀᴏᴏᴛ ᴍᴏʙɪʟᴇ","ᴍᴀɪɴ ɪᴅ ꜱᴀꜰᴇ (ʀᴏᴏᴛ ᴍᴏʙɪʟᴇ)"],
  },
  {
    id: "br-mod-root-mobile",
    name: "BR MOD ROOT MOBILE ( MAIN ID )",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/BR%20MOD%20ROOT%20MOBILE.mp4",
    category: "mobile",
    prices: [
      { duration: "1 day", priceINR: "₹99", resellerPrice: "₹55", priceUSD: "$1.30" },
      { duration: "7 day", priceINR: "₹349", resellerPrice: "₹155",priceUSD: "$3.75" },
      { duration: "15 day", priceINR: "₹599", resellerPrice: "₹315",priceUSD: "$6.90" },
      { duration: "31 day", priceINR: "₹899", resellerPrice: "₹415",priceUSD: "$9.80" },
    ],
    updateChannel: "https://t.me/+vNW83oEZIzw3Y2Fl",
    features: ["ꜱɪʟᴇɴᴛ ᴀɪᴍʙᴏᴛ","ʜᴇᴀᴅꜱʜᴏᴛ","ꜱᴘᴇᴇᴅ ʜᴀᴄᴋ","ɢʜᴏꜱᴛ ʜᴀᴄᴋ","ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ","🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ","ᴍᴀɪɴ ɪᴅ ꜱᴀꜰᴇ","ʀᴏᴏᴛ ᴍᴏʙɪʟᴇ","ɴᴏɴ ʀᴏᴏᴛ (ᴠɪʀᴛᴜᴀʟ ɴᴇᴇᴅ)"],
  },
  {
    id: "prime-hook-mobile",
    name: "PRIME HOOK MOBILE NON ROOT",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/PRIME%20HOOK%20NON%20ROOT.mp4",
    category: "mobile",
    prices: [
      { duration: "1 day", resellerPrice: "₹45", priceINR: "₹89" },
      { duration: "3 day", resellerPrice: "₹75", priceINR: "₹159" },
      { duration: "7 day", resellerPrice: "₹135",priceINR: "₹359" },
    ],
    updateChannel: "https://t.me/+cbv9Q58re1JiZjk1",
    features: ["ᴀɪᴍᴋɪʟʟ","ꜱᴘᴇᴇᴅ ʜᴀᴄᴋ","ᴀɴᴛɪ-ᴛᴇʟᴇᴘᴏʀᴛ","ʜᴇᴀᴅꜱʜᴏᴛ ʜᴀᴄᴋ","ᴀɪᴍ ᴠɪꜱɪʙʟᴇ","ᴀɪᴍꜰᴏᴠ 180°","ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ","🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ","ᴀɪᴍ ᴍᴀɢɴᴇᴛ","ʀᴀɴᴋ ᴘᴜꜱʜ ᴘᴜʀᴘᴏꜱᴇ (ɴᴏɴ ʀᴏᴏᴛ)"],
  },
  {
    id: "hg-cheats-mobile",
    name: "HG CHEATS MOBILE NON ROOT",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/HG%20NON%20ROOT%20PANEL.mp4",
    category: "mobile",
    prices: [
      { duration: "1 day", resellerPrice: "₹45", priceINR: "₹130" },
      { duration: "10 day", resellerPrice: "₹149", priceINR: "₹390" },
      { duration: "31 day", resellerPrice: "₹325", priceINR: "₹690" },
    ],
    updateChannel: "https://t.me/+lzOZzChCQmE3ZmQ1",
    features: ["ᴀɪᴍᴋɪʟʟ","ꜱᴘᴇᴇᴅ ʜᴀᴄᴋ","ᴀɴᴛɪ-ᴛᴇʟᴇᴘᴏʀᴛ","ʜᴇᴀᴅꜱʜᴏᴛ ʜᴀᴄᴋ","ᴀɪᴍ ᴠɪꜱɪʙʟᴇ","ᴀɪᴍꜰᴏᴠ 180°","ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ","🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ","ʀᴀɴᴋ ᴘᴜꜱʜ ᴘᴜʀᴘᴏꜱᴇ","ɴᴏɴ ʀᴏᴏᴛ"],
  },
  {
    id: "haxxcker-pro-root",
    name: "HAXXCKER PRO ROOT MOBILE ( MAIN ID )",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/HAXXCKER%20PRO.mp4",
    category: "mobile",
    prices: [
      { duration: "10 day", resellerPrice: "₹np", priceINR: "₹580" },
      { duration: "20 day", resellerPrice: "₹np", priceINR: "₹1080" },
      { duration: "30 day", resellerPrice: "₹np", priceINR: "₹1580" },
    ],
    updateChannel: "https://t.me/+1bfn34OibsAyODc1",
    features: [
      "Headshot Hack", "AimFov 360°", "Esp Line Location", "Stream Mode", "🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ", "root support", "non root (virtual - vphone)"],
  },
];

export const pcProducts: Product[] = [
  {
    id: "br-mod-pc-aim",
    name: "BR MOD PC AIM SILENT ( MAIN ID )",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/BR%20MOD%20PC%20PANEL.mp4",
    category: "pc",
    prices: [
      { duration: "1 day", priceINR: "₹129", resellerPrice: "₹59", priceUSD: "$1.40" },
      { duration: "10 day", priceINR: "₹495", resellerPrice: "₹259", priceUSD: "$5.30" },
      { duration: "31 day", priceINR: "₹899", resellerPrice: "₹520", priceUSD: "$8.95" },
    ],
    updateChannel: "https://t.me/+vNW83oEZIzw3Y2Fl",
    features: ["⛨ ᴀɪᴍʙᴏᴛ ʟɪᴛᴇ","⛨ ᴀɪᴍꜰᴏᴠ 1200°","⛨ ɢʜᴏꜱᴛ","⛨ ᴜɴᴅᴇʀ ᴄᴀʀ","⛨ ᴛᴇʟᴇᴘᴏʀᴛ ᴡᴀʟʟ ᴄꜱ","⛨ ᴛᴇʟᴇᴘᴏʀᴛ ᴡᴀʟʟ ʙʀ","⛨ ꜱᴘᴇᴇᴅ ʜᴀᴄᴋ","⛨ ɢʜᴏꜱᴛ ꜱʏɴᴄ","⛨ ᴡᴀʟʟ ʜᴀᴄᴋ","⛨ ꜱᴄʀᴇᴇɴ ꜱᴛᴏᴘ","⛨ ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ","⛨ ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ","main id full safe"],
  },
  {
    id: "basic-customized-pc",
    name: "BASIC CUSTOMIZED PC PANEL ( MAIN ID )",
    videoUrl: "https://res.cloudinary.com/dda4gh2wm/video/upload/q_auto/f_auto/v1780157629/BASIC_PC_PANEL_wuorib.mp4",
    category: "pc",
    prices: [
      { duration: "1 day", resellerPrice: "₹80", priceINR: "₹180" },
      { duration: "11 day", resellerPrice: "₹255", priceINR: "₹559" },
      { duration: "31 day", resellerPrice: "₹489", priceINR: "₹1399" },
      { duration: "Lifetime", resellerPrice: "₹1900", priceINR: "₹3299" },
    ],
    updateChannel: "https://t.me/jprimeallcustompcpanel",
    features: ["☉ ᴀɪᴍʙᴏᴛ ɢʟᴏʙᴀʟ","☉ ᴀɪᴍʙᴏᴛ ᴇxᴛᴇʀɴᴀʟ","☉ ꜱɴɪᴘᴇʀ ꜱᴡɪᴛᴄʜ","☉ ꜱɴɪᴘᴇʀ ꜱᴄᴏᴘᴇ","☉ ɢʟɪᴛᴄʜ ꜰɪʀᴇ","☉ ᴇꜱᴘ ʟɪɴᴇ ʙᴏx","☉ ᴇꜱᴘ ᴀʟᴇʀᴛ","☉ ᴇꜱᴘ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ ᴡᴇᴀᴘᴏɴ","☉ ᴀᴜᴛᴏ ʀᴇꜰʀᴇꜱʜ","☉ ꜱᴛʀᴇᴀᴍᴇʀ ᴍᴏᴅᴇ"],
  },
];

export const allProducts = [...mobileProducts, ...pcProducts];
