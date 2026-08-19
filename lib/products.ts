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

  // External reseller API configuration
  apiProductId?: string;
  requiresAndroidId?: boolean;
}

export const mobileProducts: Product[] = [
 {
    id: "nine-non-root",
    name: "PRIVATE - AIM SILENT NON ROOT (MAIN ID)",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/9x.mp4",
    category: "mobile",
    prices: [
      { duration: "10 day", priceINR: "₹440", resellerPrice: "₹255", priceUSD: "$1.38" },
      { duration: "20 day", priceINR: "₹880", resellerPrice: "₹510",priceUSD: "$2.20" },
      { duration: "30 day", priceINR: "₹1280", resellerPrice: "₹765",priceUSD: "$9.80" },
    ],
    updateChannel: "t.me/JPRIMEADMIN",
    features: ["ᴍᴀɪɴ ɪᴅ ꜱᴀꜰᴇ","ɴᴏɴ ʀᴏᴏᴛ","ᴅʀᴀɢ ʜᴇᴀᴅsʜᴏᴛ","ʜᴇᴀᴅ ʟᴏᴄᴋ","ɴɪᴄᴋ ʟᴏᴄᴋ","🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ","ɴᴏɴ ʀᴏᴏᴛ ᴍᴏʙɪʟᴇ","ʀᴀɴᴋ ᴘᴜꜱʜ ᴘᴜʀᴘᴏꜱᴇ"],
  },
  
  {
  id: "haxxcker-client",
  name: "HAXXCKER CLIENT NON ROOT ( main id )",
   videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/haxx%20v.mp4",
  category: "mobile",
    // BALA MOD XYZ V1
  apiProductId: "133",
  requiresAndroidId: true,

  prices: [
    { duration: "1 Hours", resellerPrice: "₹10", priceINR: "₹25" },
    { duration: "3 Hours", resellerPrice: "₹35", priceINR: "₹56" },
    { duration: "6 Hours", resellerPrice: "₹65", priceINR: "₹90" },
    { duration: "12 Hours", resellerPrice: "₹160", priceINR: "₹190" },
    { duration: "1 Days", resellerPrice: "₹240", priceINR: "₹300" },
    { duration: "2 Days", resellerPrice: "₹480", priceINR: "₹600" },
    { duration: "3 Days", resellerPrice: "₹680", priceINR: "₹850" },
    { duration: "5 Days", resellerPrice: "₹1112", priceINR: "₹1390" },
    { duration: "7 Days", resellerPrice: "₹1432", priceINR: "₹1790" },
  ],

  updateChannel: "https://t.me/+jxcj7KJjcfI3MmQ1",
  features: ["ɴᴏɴ ʀᴏᴏᴛ", "ᴅʀᴀɢ ʜᴇᴀᴅsʜᴏᴛ 100%", "ᴅʀᴀɢ ʜᴇᴀᴅsʜᴏᴛ 50%", "ʜᴇᴀᴅ ʟᴏᴄᴋ", "ʙᴏᴅʏ ʜᴇᴀᴅsʜᴏᴛ", "ᴄʜᴇsᴛ ʜᴇᴀᴅsʜᴏᴛ"]
},
  {
    id: "drip-client-non-root",
    name: "DRIP CLIENT NON ROOT MOBILE",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/DRIP%20CLIENT%20NON%20ROOT%20MOBILE.mp4",
    category: "mobile",
    prices: [
      { duration: "1 day", priceINR: "₹40", resellerPrice: "₹28", priceUSD: "$1.38" },
      { duration: "3 day", priceINR: "₹135", resellerPrice: "₹58",priceUSD: "$2.20" },
      { duration: "7 day", priceINR: "₹290", resellerPrice: "₹125",priceUSD: "$3.75" },
      { duration: "15 day", priceINR: "₹399", resellerPrice: "₹195",priceUSD: "$6.90" },
      { duration: "31 day", priceINR: "₹599", resellerPrice: "₹285",priceUSD: "$9.80" },
    ],
    updateChannel: "https://t.me/+JNLfa2pGuYxlNWNl",
    features: ["ᴀɪᴍ ᴍᴀɢɴᴇᴛ","ꜱɪʟᴇɴᴛ ᴀɪᴍ","ᴀɪᴍʙᴏᴛ ʟᴇɢɪᴛ","ꜱᴘᴇᴇᴅ ᴛɪᴍᴇʀ","ɢʜᴏꜱᴛ ʜᴀᴄᴋ","ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ","🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ","ɴᴏɴ ʀᴏᴏᴛ ᴍᴏʙɪʟᴇ","ʀᴀɴᴋ ᴘᴜꜱʜ ᴘᴜʀᴘᴏꜱᴇ"],
  },
  {
    id: "drip-client-root",
    name: "DRIP CLIENT NON ROOT MOBILE ( PROXY )",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/DRIP%20PROXY%20MOBILE.mp4",
    category: "mobile",
    prices: [
      { duration: "1 day", priceINR: "₹60", resellerPrice: "₹45", priceUSD: "$1.38" },
      { duration: "3 day", priceINR: "₹140", resellerPrice: "₹65",priceUSD: "$2.20" },
      { duration: "7 day", priceINR: "₹260", resellerPrice: "₹139",priceUSD: "$3.75" },
      { duration: "31 day", priceINR: "₹535", resellerPrice: "₹235",priceUSD: "$9.80" },
    ],
    updateChannel: "https://t.me/+JNLfa2pGuYxlNWNl",
    features: ["ɴᴏɴ ʀᴏᴏᴛ","ᴅʀᴀɢ ʜᴇᴀᴅsʜᴏᴛ","ʜᴇᴀᴅ ʟᴏᴄᴋ","ɴɪᴄᴋ ʟᴏᴄᴋ","ʙᴀᴄᴋ ᴊᴜᴍᴘ","ʜɪɢʜ ᴊᴜᴍᴘ","ғᴀsᴛ ɢᴜɴ sᴡɪᴛᴄʜ","🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ","ɴᴏɴ ʀᴏᴏᴛ ᴍᴏʙɪʟᴇ","ʀᴀɴᴋ ᴘᴜꜱʜ ᴘᴜʀᴘᴏꜱᴇ"],
  },
  {
    id: "br-mod-root-mobile",
    name: "BR MOD ROOT MOBILE ( MAIN ID )",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/BR%20MOD%20ROOT%20MOBILE.mp4",
    category: "mobile",
    prices: [
      { duration: "1 day", priceINR: "₹75", resellerPrice: "₹45", priceUSD: "$1.30" },
      { duration: "7 day", priceINR: "₹295", resellerPrice: "₹105",priceUSD: "$3.75" },
      { duration: "15 day", priceINR: "₹545", resellerPrice: "₹215",priceUSD: "$6.90" },
      { duration: "31 day", priceINR: "₹795", resellerPrice: "₹295",priceUSD: "$9.80" },
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
      { duration: "1 day", resellerPrice: "₹29", priceINR: "₹70" },
      { duration: "3 day", resellerPrice: "₹59", priceINR: "₹145" },
      { duration: "7 day", resellerPrice: "₹119",priceINR: "₹295" },
      { duration: "10 day", resellerPrice: "₹147",priceINR: "₹345" },
    ],
    updateChannel: "https://t.me/+cbv9Q58re1JiZjk1",
    features: ["ᴀɪᴍᴋɪʟʟ","ꜱᴘᴇᴇᴅ ʜᴀᴄᴋ","ᴀɴᴛɪ-ᴛᴇʟᴇᴘᴏʀᴛ","ʜᴇᴀᴅꜱʜᴏᴛ ʜᴀᴄᴋ","ᴀɪᴍ ᴠɪꜱɪʙʟᴇ","ᴀɪᴍꜰᴏᴠ 180°","ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ","🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ","ᴀɪᴍ ᴍᴀɢɴᴇᴛ","ʀᴀɴᴋ ᴘᴜꜱʜ ᴘᴜʀᴘᴏꜱᴇ (ɴᴏɴ ʀᴏᴏᴛ)"],
  },
  {
    id: "silent-cheats-root",
    name: "SILENT CHEAT INJECTOR ROOT ( main id )",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/silent.mp4",
    category: "mobile",
    prices: [
      { duration: "1 day safe", priceINR: "₹78", resellerPrice: "₹28", priceUSD: "$1.38" },
      { duration: "3 day safe", priceINR: "₹150", resellerPrice: "₹68",priceUSD: "$2.20" },
      { duration: "7 day safe", priceINR: "₹348", resellerPrice: "₹138",priceUSD: "$3.75" },
      { duration: "15 day safe", priceINR: "₹595", resellerPrice: "₹268",priceUSD: "$6.90" },
      { duration: "31 day safe", priceINR: "₹899", resellerPrice: "₹528",priceUSD: "$9.80" },
      { duration: "1 day brutal", priceINR: "₹78", resellerPrice: "₹28", priceUSD: "$1.38" },
      { duration: "3 day brutal", priceINR: "₹150", resellerPrice: "₹68",priceUSD: "$2.20" },
      { duration: "7 day brutal", priceINR: "₹345", resellerPrice: "₹138",priceUSD: "$3.75" },
      { duration: "15 day brutal", priceINR: "₹595", resellerPrice: "₹268",priceUSD: "$6.90" },
      { duration: "31 day brutal", priceINR: "₹895", resellerPrice: "₹528",priceUSD: "$9.80" },
    ],
    updateChannel: "https://t.me/+GKY5UbxCPhlhNTU1",
    features: ["ᴀɪᴍ ᴍᴀɢɴᴇᴛ","ꜱɪʟᴇɴᴛ ᴀɪᴍ","ᴀɪᴍʙᴏᴛ ʟᴇɢɪᴛ","ꜱᴘᴇᴇᴅ ᴛɪᴍᴇʀ","ɢʜᴏꜱᴛ ʜᴀᴄᴋ","ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ","🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ","ʀᴏᴏᴛ ᴍᴏʙɪʟᴇ"],
  },
    {
    id: "rapid-core-root-panel",
    name: "RAPID CORE INJECTOR ROOT ( main id )",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/rapid.mp4",
    category: "mobile",
    prices: [
      { duration: "1 day", priceINR: "₹85", resellerPrice: "₹39", priceUSD: "$1.38" },
      { duration: "7 day", priceINR: "₹320", resellerPrice: "₹145",priceUSD: "$3.75" },
      { duration: "15 day", priceINR: "₹590", resellerPrice: "₹290",priceUSD: "$6.90" },
      { duration: "31 day", priceINR: "₹1019", resellerPrice: "₹480",priceUSD: "$9.80" },
    ],
    updateChannel: "https://t.me/+fy2vh_LXjJs4ODk9",
    features: ["ᴀɪᴍ ᴍᴀɢɴᴇᴛ","ꜱɪʟᴇɴᴛ ᴀɪᴍ","ᴀɪᴍʙᴏᴛ ʟᴇɢɪᴛ","ꜱᴘᴇᴇᴅ ᴛɪᴍᴇʀ","ɢʜᴏꜱᴛ ʜᴀᴄᴋ","ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ","🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ","ɴᴏɴ ʀᴏᴏᴛ ᴍᴏʙɪʟᴇ","ʀᴀɴᴋ ᴘᴜꜱʜ ᴘᴜʀᴘᴏꜱᴇ"],
  },
  {
    id: "hg-cheats-mobile",
    name: "HG CHEATS MOBILE NON ROOT",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/HG%20NON%20ROOT%20PANEL.mp4",
    category: "mobile",
    prices: [
      { duration: "1 day", resellerPrice: "₹45", priceINR: "₹60" },
      { duration: "10 day", resellerPrice: "₹149", priceINR: "₹320" },
      { duration: "31 day", resellerPrice: "₹299", priceINR: "₹550" },
    ],
    updateChannel: "https://t.me/+lzOZzChCQmE3ZmQ1",
    features: ["ᴀɪᴍᴋɪʟʟ","ꜱᴘᴇᴇᴅ ʜᴀᴄᴋ","ᴀɴᴛɪ-ᴛᴇʟᴇᴘᴏʀᴛ","ʜᴇᴀᴅꜱʜᴏᴛ ʜᴀᴄᴋ","ᴀɪᴍ ᴠɪꜱɪʙʟᴇ","ᴀɪᴍꜰᴏᴠ 180°","ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ","🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ","ʀᴀɴᴋ ᴘᴜꜱʜ ᴘᴜʀᴘᴏꜱᴇ","ɴᴏɴ ʀᴏᴏᴛ"],
  },
  {
    id: "haxxcker-pro-root",
    name: "HAXXCKER PRO ROOT - ( MAIN ID ) & NON ROOT",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/HAXXCKER%20PRO.mp4",
    category: "mobile",
    prices: [
      { duration: "10 day", resellerPrice: "₹np", priceINR: "₹549" },
      { duration: "20 day", resellerPrice: "₹np", priceINR: "₹1049" },
      { duration: "30 day", resellerPrice: "₹np", priceINR: "₹1449" },
      { duration: "60 day", resellerPrice: "₹np", priceINR: "₹2799" },
      { duration: "120 day", resellerPrice: "₹np", priceINR: "₹5449" },
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
      { duration: "1 day", priceINR: "₹85", resellerPrice: "₹48", priceUSD: "$1.40" },
      { duration: "10 day", priceINR: "₹435", resellerPrice: "₹245", priceUSD: "$5.30" },
      { duration: "31 day", priceINR: "₹825", resellerPrice: "₹490", priceUSD: "$8.95" },
    ],
    updateChannel: "https://t.me/+vNW83oEZIzw3Y2Fl",
    features: ["⛨ ᴀɪᴍʙᴏᴛ ʟɪᴛᴇ","⛨ ᴀɪᴍꜰᴏᴠ 1200°","⛨ ɢʜᴏꜱᴛ","⛨ ᴜɴᴅᴇʀ ᴄᴀʀ","⛨ ᴛᴇʟᴇᴘᴏʀᴛ ᴡᴀʟʟ ᴄꜱ","⛨ ᴛᴇʟᴇᴘᴏʀᴛ ᴡᴀʟʟ ʙʀ","⛨ ꜱᴘᴇᴇᴅ ʜᴀᴄᴋ","⛨ ɢʜᴏꜱᴛ ꜱʏɴᴄ","⛨ ᴡᴀʟʟ ʜᴀᴄᴋ","⛨ ꜱᴄʀᴇᴇɴ ꜱᴛᴏᴘ","⛨ ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ","⛨ ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ","MAIN ID FULL SAFE"],
  },
  {
    id: "basic-customized-pc",
    name: "BASIC CUSTOMIZED PC PANEL ( MAIN ID )",
    videoUrl: "https://res.cloudinary.com/dda4gh2wm/video/upload/q_auto/f_auto/v1780157629/BASIC_PC_PANEL_wuorib.mp4",
    category: "pc",
    prices: [
      { duration: "1 day", resellerPrice: "₹30", priceINR: "₹65" },
      { duration: "15 day", resellerPrice: "₹255", priceINR: "₹559" },
      { duration: "31 day", resellerPrice: "₹489", priceINR: "₹1099" },
      { duration: "Lifetime", resellerPrice: "₹1300", priceINR: "₹1999" },
    ],
    updateChannel: "https://t.me/jprimeallcustompcpanel",
    features: ["☉ ᴀɪᴍʙᴏᴛ ɢʟᴏʙᴀʟ","☉ ᴀɪᴍʙᴏᴛ ᴇxᴛᴇʀɴᴀʟ","☉ ꜱɴɪᴘᴇʀ ꜱᴡɪᴛᴄʜ","☉ ꜱɴɪᴘᴇʀ ꜱᴄᴏᴘᴇ","☉ ɢʟɪᴛᴄʜ ꜰɪʀᴇ","☉ ᴇꜱᴘ ʟɪɴᴇ ʙᴏx","☉ ᴇꜱᴘ ᴀʟᴇʀᴛ","☉ ᴇꜱᴘ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ ᴡᴇᴀᴘᴏɴ","☉ ᴀᴜᴛᴏ ʀᴇꜰʀᴇꜱʜ","☉ ꜱᴛʀᴇᴀᴍᴇʀ ᴍᴏᴅᴇ"],
  },
  {
    id: "brutal-haxxcer-pc",
    name: "AIM SILENT EXE - HAXXCKER CLIENT",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/haxx%20silent.mp4",
    category: "pc",
    prices: [
      { duration: "1 day", resellerPrice: "₹30", priceINR: "₹65" },
      { duration: "15 day", resellerPrice: "₹255", priceINR: "₹559" },
      { duration: "31 day", resellerPrice: "₹489", priceINR: "₹1099" },
      { duration: "Lifetime", resellerPrice: "₹1300", priceINR: "₹1999" },
    ],
    updateChannel: "https://t.me/+F8nTtUENXi9mYmY1",
    features: ["⛨ ᴀɪᴍ ᴅᴏᴡɴᴋɪʟʟ","⛨ ᴀɪᴍꜰᴏᴠ 1200°","⛨ ᴜᴘ ᴘʟᴀʏᴇʀ","⛨ ᴛᴇʟᴇ ᴋɪʟʟ 10ᴍ","⛨ᴛᴇʟᴇᴘᴏʀᴛ ʜᴀᴄᴋ ᴄꜱ","⛨ᴛᴇʟᴇᴘᴏʀᴛ ʜᴀᴄᴋ ʙʀ","⛨ ᴍᴇᴅᴋɪᴛ ʀᴜɴ","⛨ ꜱᴘᴇᴇᴅ ʜᴀᴄᴋ ᴊᴏʏꜱᴛɪᴄᴋ","⛨ ᴄʟɪᴍʙ ᴜᴘ","⛨ ɴᴏ ʀᴇᴄᴏɪʟ","⛨ ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ","⛨ ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ"],
  },
  {
    id: "brutal-customized-pc",
    name: "AIM COVER PANEL ( Rank push )",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/AIM%20COVER%20PC.mp4",
    category: "pc",
    prices: [
      { duration: "1 day", resellerPrice: "₹30", priceINR: "₹65" },
      { duration: "15 day", resellerPrice: "₹255", priceINR: "₹559" },
      { duration: "31 day", resellerPrice: "₹489", priceINR: "₹1099" },
      { duration: "Lifetime", resellerPrice: "₹1300", priceINR: "₹1999" },
    ],
    updateChannel: "https://t.me/jprimeallcustompcpanel",
    features: ["⛨ ᴀɪᴍ ᴅᴏᴡɴᴋɪʟʟ","⛨ ᴀɪᴍꜰᴏᴠ 1200°","⛨ ᴜᴘ ᴘʟᴀʏᴇʀ","⛨ ᴛᴇʟᴇ ᴋɪʟʟ 10ᴍ","⛨ᴛᴇʟᴇᴘᴏʀᴛ ʜᴀᴄᴋ ᴄꜱ","⛨ᴛᴇʟᴇᴘᴏʀᴛ ʜᴀᴄᴋ ʙʀ","⛨ ᴍᴇᴅᴋɪᴛ ʀᴜɴ","⛨ ꜱᴘᴇᴇᴅ ʜᴀᴄᴋ ᴊᴏʏꜱᴛɪᴄᴋ","⛨ ᴄʟɪᴍʙ ᴜᴘ","⛨ ɴᴏ ʀᴇᴄᴏɪʟ","⛨ ᴀᴜᴛᴏ ꜱᴡɪᴛᴄʜ","⛨ ꜰᴀꜱᴛ ꜱᴡɪᴛᴄʜ","⛨ ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ","⛨ ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ"],
  },
    {
    id: "brutal-customized-aim-kill-pc",
    name: "AIM KILL PANEL ( Rank push )",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/akill.mp4",
    category: "pc",
    prices: [
      { duration: "1 day", resellerPrice: "₹30", priceINR: "₹85" },
      { duration: "15 day", resellerPrice: "₹255", priceINR: "₹569" },
      { duration: "31 day", resellerPrice: "₹489", priceINR: "₹1199" },
      { duration: "Lifetime", resellerPrice: "₹1400", priceINR: "₹2199" },
    ],
    updateChannel: "https://t.me/jprimeallcustompcpanel",
    features: ["⛨ ᴀɪᴍ ᴅᴏᴡɴᴋɪʟʟ","⛨ ᴀɪᴍꜰᴏᴠ 1200°","⛨ ᴜᴘ ᴘʟᴀʏᴇʀ","⛨ ᴛᴇʟᴇ ᴋɪʟʟ 10ᴍ","⛨ᴛᴇʟᴇᴘᴏʀᴛ ʜᴀᴄᴋ ᴄꜱ","⛨ᴛᴇʟᴇᴘᴏʀᴛ ʜᴀᴄᴋ ʙʀ","⛨ ᴍᴇᴅᴋɪᴛ ʀᴜɴ","⛨ ꜱᴘᴇᴇᴅ ʜᴀᴄᴋ ᴊᴏʏꜱᴛɪᴄᴋ","⛨ ᴄʟɪᴍʙ ᴜᴘ","⛨ ɴᴏ ʀᴇᴄᴏɪʟ","⛨ ᴀᴜᴛᴏ ꜱᴡɪᴛᴄʜ","⛨ ꜰᴀꜱᴛ ꜱᴡɪᴛᴄʜ","⛨ ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ","⛨ ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ"],
  },
];

export const allProducts = [...mobileProducts, ...pcProducts];
