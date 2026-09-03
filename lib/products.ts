export interface PriceTier {
  duration: string;
  priceINR: string;
  resellerPrice?: string;
  priceUSD?: string;

  // Duration exactly as required by the seller API.
  // Only used for products that have a sellerPid.
  sellerDuration?: string;
}

export interface Product {
  id: string;
  name: string;
  category: "mobile" | "pc" | "ios";
  fulfillmentType?: "API" | "LOCAL"; // Added fulfillment type
  sellerPid?: string | number;       // Updated type to support string or number PIDs
  prices: PriceTier[];
  updateChannel: string;
  features: string[];
  videoPlaceholder?: string;
  videoUrl?: string;
}

export const mobileProducts: Product[] = [
  {
    id: "nine-non-root",
    name: "PRIVATE - AIM SILENT NON ROOT (MAIN ID)",
    fulfillmentType: "LOCAL",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/9x.mp4",
    category: "mobile",
    prices: [
      { duration: "10 day", priceINR: "₹440", resellerPrice: "₹255", priceUSD: "$1.38" },
      { duration: "20 day", priceINR: "₹880", resellerPrice: "₹510", priceUSD: "$2.20" },
      { duration: "30 day", priceINR: "₹1280", resellerPrice: "₹765", priceUSD: "$9.80" },
    ],
    updateChannel: "https://t.me/+vmEtPFDt7wJmYTY1",
    features: ["ᴍᴀɪɴ ɪᴅ ꜱᴀꜰᴇ", "ɴᴏɴ ʀᴏᴏᴛ", "ᴅʀᴀɢ ʜᴇᴀᴅsʜᴏᴛ", "ʜᴇᴀᴅ ʟᴏᴄᴋ", "ɴɪᴄᴋ ʟᴏᴄᴋ", "🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ", "ɴᴏɴ ʀᴏᴏᴛ ᴍᴏʙɪʟᴇ", "ʀᴀɴᴋ ᴘᴜꜱʜ ᴘᴜʀᴘᴏꜱᴇ"],
  },

  {
    id: "bala-v2",
    name: "BALA MOD XYZ ~ V2 FF NONROOT",
    fulfillmentType: "API",
    sellerPid: "136",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/bala.mp4",
    category: "mobile",
    prices: [
      { duration: "1 Hours", resellerPrice: "₹10", priceINR: "₹25", sellerDuration: "1 Hours" },
      { duration: "3 Hours", resellerPrice: "₹35", priceINR: "₹56", sellerDuration: "3 Hours" },
      { duration: "6 Hours", resellerPrice: "₹65", priceINR: "₹90", sellerDuration: "6 Hours" },
      { duration: "12 Hours", resellerPrice: "₹160", priceINR: "₹190", sellerDuration: "12 Hours" },
      { duration: "1 Days", resellerPrice: "₹240", priceINR: "₹300", sellerDuration: "1 Days" },
      { duration: "7 Days", resellerPrice: "₹1432", priceINR: "₹1790", sellerDuration: "7 Days" },
    ],
    updateChannel: "https://t.me/+yzkB9kD8zzUzMDQ1",
    features: ["ʟᴏᴄᴀᴛɪᴏɴ","ᴅʀᴀɢ ʜᴇᴀᴅꜱʜᴏᴛ 100%", "ᴅʀᴀɢ ʜᴇᴀᴅꜱʜᴏᴛ 50%", "ʜᴇᴀᴅ ʟᴏᴄᴋ", "ʙᴏᴅʏ ʜᴇᴀᴅꜱʜᴏᴛ", "ᴄʜᴇꜱᴛ ʜᴇᴀᴅꜱʜᴏᴛ", "ᴛᴇʟᴇᴘᴏʀᴛ"],
  },

  {
    id: "silent-cheat-proxy",
    name: "SILENT CHEAT FF NONROOT PROXY",
    fulfillmentType: "API",
    sellerPid: "148",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/silent%20proxy.mp4",
    category: "mobile",
    prices: [
      { duration: "1 Hours Apk Silent", priceINR: "₹78", resellerPrice: "₹28", priceUSD: "$1.38", sellerDuration: "1 Hours Apk Silent" },
      { duration: "3 Hours Apk Silent", priceINR: "₹150", resellerPrice: "₹68", priceUSD: "$2.20", sellerDuration: "3 Hours Apk Silent" },
      { duration: "6 Hours Apk Silent", priceINR: "₹348", resellerPrice: "₹138", priceUSD: "$3.75", sellerDuration: "6 Hours Apk Silent" },
      { duration: "12 Hours Apk Silent", priceINR: "₹595", resellerPrice: "₹268", priceUSD: "$6.90", sellerDuration: "12Hours Apk Silent" },
      { duration: "1 DaYs Apk Silent", priceINR: "₹899", resellerPrice: "₹528", priceUSD: "$9.80", sellerDuration: "1 DaYs Apk Silent" },
      { duration: "3 DaYs Apk Silent", priceINR: "₹78", resellerPrice: "₹28", priceUSD: "$1.38", sellerDuration: "3 DaYs Apk Silent" },
      { duration: "7 DaYs Apk Silent", priceINR: "₹150", resellerPrice: "₹68", priceUSD: "$2.20", sellerDuration: "7 DaYs Apk Silent" },
      { duration: "1 Hours Config Proxy", priceINR: "₹345", resellerPrice: "₹138", priceUSD: "$3.75", sellerDuration: "1 Hours Config Proxy" },
      { duration: "3 Hours Config Proxy", priceINR: "₹595", resellerPrice: "₹268", priceUSD: "$6.90", sellerDuration: "3 Hours Config Proxy" },
      { duration: "6 Hours Config Proxy", priceINR: "₹895", resellerPrice: "₹528", priceUSD: "$9.80", sellerDuration: "6 Hours Config Proxy" },
      { duration: "12 Hours Config Proxy", priceINR: "₹895", resellerPrice: "₹528", priceUSD: "$9.80", sellerDuration: "12 Hours Config Proxy" },
      { duration: "1 DaYs Config Proxy", priceINR: "₹895", resellerPrice: "₹528", priceUSD: "$9.80", sellerDuration: "1 DaYs Config Proxy" },
      { duration: "3 DaYs Config Proxy", priceINR: "₹895", resellerPrice: "₹528", priceUSD: "$9.80", sellerDuration: "3 DaYs Config Proxy" },
      { duration: "7 DaYs Config Proxy", priceINR: "₹895", resellerPrice: "₹528", priceUSD: "$9.80", sellerDuration: "7 DaYs Config Proxy" },
    ],
    updateChannel: "https://t.me/+GKY5UbxCPhlhNTU1",
    features: ["ʟᴏᴄᴀᴛɪᴏɴ","ᴅʀᴀɢ ʜᴇᴀᴅꜱʜᴏᴛ 100%", "ᴅʀᴀɢ ʜᴇᴀᴅꜱʜᴏᴛ 50%", "ʜᴇᴀᴅ ʟᴏᴄᴋ", "ʙᴏᴅʏ ʜᴇᴀᴅꜱʜᴏᴛ", "ᴄʜᴇꜱᴛ ʜᴇᴀᴅꜱʜᴏᴛ", "ᴛᴇʟᴇᴘᴏʀᴛ"],
  },

  {
    id: "drip-client-apk",
    name: "DRIPCLIENT FF NONROOT APKMOD",
    fulfillmentType: "API",
    sellerPid: "62",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/DRIP%20CLIENT%20NON%20ROOT%20MOBILE.mp4",
    category: "mobile",
    prices: [
      { duration: "1 day", priceINR: "₹40", resellerPrice: "₹28", priceUSD: "$1.38", sellerDuration: "1 Days NONROOT" },
      { duration: "3 day", priceINR: "₹135", resellerPrice: "₹58", priceUSD: "$2.20", sellerDuration: "3 Days NONROOT" },
      { duration: "7 day", priceINR: "₹290", resellerPrice: "₹125", priceUSD: "$3.75", sellerDuration: "7 Days NONROOT" },
      { duration: "15 day", priceINR: "₹399", resellerPrice: "₹195", priceUSD: "$6.90", sellerDuration: "15 Days NONROOT" },
      { duration: "31 day", priceINR: "₹599", resellerPrice: "₹285", priceUSD: "$9.80", sellerDuration: "30 Days NONROOT" },
    ],
    updateChannel: "https://t.me/+JNLfa2pGuYxlNWNl",
    features: ["ᴀɪᴍ ᴍᴀɢɴᴇᴛ", "ꜱɪʟᴇɴᴛ ᴀɪᴍ", "ᴀɪᴍʙᴏᴛ ʟᴇɢɪᴛ", "ꜱᴘᴇᴇᴅ ᴛɪᴍᴇʀ", "ɢʜᴏꜱᴛ ʜᴀᴄᴋ", "ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ", "🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ", "ɴᴏɴ ʀᴏᴏᴛ ᴍᴏʙɪʟᴇ", "ʀᴀɴᴋ ᴘᴜꜱʜ ᴘᴜꜱᴘᴏꜱᴇ"],
  },

  {
    id: "drip-client-root",
    name: "DRIPCLIENT PROXY FF NONROOT ANDROID",
    fulfillmentType: "API",
    sellerPid: "91",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/DRIP%20PROXY%20MOBILE.mp4",
    category: "mobile",
    prices: [
      { duration: "1 DaYs", priceINR: "₹60", resellerPrice: "₹45", priceUSD: "$1.38", sellerDuration: "1 DaYs"},
      { duration: "3 DaYs", priceINR: "₹60", resellerPrice: "₹45", priceUSD: "$1.38", sellerDuration: "3 DaYs"},
     { duration: "7 DaYs", priceINR: "₹60", resellerPrice: "₹45", priceUSD: "$1.38", sellerDuration: "7 DaYs"},
      { duration: "30 DaYs", priceINR: "₹60", resellerPrice: "₹45", priceUSD: "$1.38", sellerDuration: "30 DaYs"},
    ],
    updateChannel: "https://t.me/+JNLfa2pGuYxlNWNl",
    features: ["ɴᴏɴ ʀᴏᴏᴛ", "ᴅʀᴀɢ ʜᴇᴀᴅsʜᴏᴛ", "ʜᴇᴀᴅ ʟᴏᴄᴋ", "ɴɪᴄᴋ ʟᴏᴄᴋ", "ʙᴀᴄᴋ ᴊᴜᴍᴘ", "ʜɪɢʜ ᴊᴜᴍᴘ", "ғᴀsᴛ ɢᴜɴ sᴡɪᴛᴄʜ", "🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ", "ɴᴏɴ ʀᴏᴏᴛ ᴍᴏʙɪʟᴇ", "ʀᴀɴᴋ ᴘᴜꜱʜ ᴘᴜʀᴘᴏꜱᴇ"],
  },

  {
    id: "br-mod-root",
    name: "BR MOD FF ROOT ANDROID",
    fulfillmentType: "API",
    sellerPid: "67",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/BR%20MOD%20ROOT%20MOBILE.mp4",
    category: "mobile",
    prices: [
      { duration: "1 day", priceINR: "₹75", resellerPrice: "₹45", priceUSD: "$1.30", sellerDuration: "1 Days" },
      { duration: "7 day", priceINR: "₹295", resellerPrice: "₹105", priceUSD: "$3.75", sellerDuration: "7 Days" },
      { duration: "15 day", priceINR: "₹545", resellerPrice: "₹215", priceUSD: "$6.90", sellerDuration: "15 Days" },
      { duration: "31 day", priceINR: "₹795", resellerPrice: "₹295", priceUSD: "$9.80", sellerDuration: "31 Days" },
    ],
    updateChannel: "https://t.me/+vNW83oEZIzw3Y2Fl",
    features: ["ꜱɪʟᴇɴᴛ ᴀɪᴍʙᴏᴛ", "ʜᴇᴀᴅꜱʜᴏᴛ", "ꜱᴘᴇᴇᴅ ʜᴀᴄᴋ", "ɢʜᴏꜱᴛ ʜᴀᴄᴋ", "ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ", "🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ", "ᴍᴀɪɴ ɪᴅ ꜱᴀꜰᴇ", "ʀᴏᴏᴛ ᴍᴏʙɪʟᴇ", "ɴᴏɴ ʀᴏᴏᴛ (ᴠɪʀᴛᴜᴀʟ ɴᴇᴇᴅ)"],
  },

  {
    id: "prime-hook",
    name: "PRIME HOOK FF NONROOT ANDROID",
    fulfillmentType: "API",
    sellerPid: "48",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/PRIME%20HOOK%20NON%20ROOT.mp4",
    category: "mobile",
    prices: [
      { duration: "1 day", resellerPrice: "₹29", priceINR: "₹70", sellerDuration: "1 Days Nonroot" },
      { duration: "3 day", resellerPrice: "₹59", priceINR: "₹145", sellerDuration: "3 Days Nonroot" },
      { duration: "7 day", resellerPrice: "₹119", priceINR: "₹295", sellerDuration: "7 Days NonRoot" },
      { duration: "10 day", resellerPrice: "₹147", priceINR: "₹345", sellerDuration: "10 Days Nonroot" },
    ],
    updateChannel: "https://t.me/+cbv9Q58re1JiZjk1",
    features: ["ᴀɪᴍᴋɪʟʟ", "ꜱᴘᴇᴇᴅ ʜᴀᴄᴋ", "ᴀɴᴛɪ-ᴛᴇʟᴇᴘᴏʀᴛ", "ʜᴇᴀᴅꜱʜᴏᴛ ʜᴀᴄᴋ", "ᴀɪᴍ ᴠɪꜱɪʙʟᴇ", "ᴀɪᴍꜰᴏᴠ 180°", "ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ", "🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ", "ᴀɪᴍ ᴍᴀɢɴᴇᴛ", "ʀᴀɴᴋ ᴘᴜꜱʜ ᴘᴜʀᴘᴏꜱᴇ (ɴᴏɴ ʀᴏᴏᴛ)"],
  },

  {
    id: "silent-cheat-root",
    name: "SILENT CHEAT FF ROOT ANDROID",
    fulfillmentType: "API",
    sellerPid: "128",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/silent.mp4",
    category: "mobile",
    prices: [
      { duration: "1 day safe", priceINR: "₹78", resellerPrice: "₹28", priceUSD: "$1.38", sellerDuration: "1 Days SAFE" },
      { duration: "3 day safe", priceINR: "₹150", resellerPrice: "₹68", priceUSD: "$2.20", sellerDuration: "3 Days SAFE" },
      { duration: "7 day safe", priceINR: "₹348", resellerPrice: "₹138", priceUSD: "$3.75", sellerDuration: "7 Days SAFE" },
      { duration: "15 day safe", priceINR: "₹595", resellerPrice: "₹268", priceUSD: "$6.90", sellerDuration: "14 Days SAFE" },
      { duration: "31 day safe", priceINR: "₹899", resellerPrice: "₹528", priceUSD: "$9.80", sellerDuration: "28 Days SAFE" },
      { duration: "1 day brutal", priceINR: "₹78", resellerPrice: "₹28", priceUSD: "$1.38", sellerDuration: "1 Days BRUTAL" },
      { duration: "3 day brutal", priceINR: "₹150", resellerPrice: "₹68", priceUSD: "$2.20", sellerDuration: "3 Days BRUTAL" },
      { duration: "7 day brutal", priceINR: "₹345", resellerPrice: "₹138", priceUSD: "$3.75", sellerDuration: "7 Days BRUTAL" },
      { duration: "15 day brutal", priceINR: "₹595", resellerPrice: "₹268", priceUSD: "$6.90", sellerDuration: "14 Days BRUTAL" },
      { duration: "31 day brutal", priceINR: "₹895", resellerPrice: "₹528", priceUSD: "$9.80", sellerDuration: "28 Days BRUTAL" },
    ],
    updateChannel: "https://t.me/+GKY5UbxCPhlhNTU1",
    features: ["ᴀɪᴍ ᴍᴀɢɴᴇᴛ", "ꜱɪʟᴇɴᴛ ᴀɪᴍ", "ᴀɪᴍʙᴏᴛ ʟᴇɢɪᴛ", "ꜱᴘᴇᴇᴅ ᴛɪᴍᴇʀ", "ɢʜᴏꜱᴛ ʜᴀᴄᴋ", "ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ", "🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ", "ʀᴏᴏᴛ ᴍᴏʙɪʟᴇ"],
  },

  {
    id: "rapid-core-root-panel",
    name: "RAPID CORE INJECTOR ROOT ( main id )",
    fulfillmentType: "LOCAL",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/rapid.mp4",
    category: "mobile",
    prices: [
      { duration: "1 day", priceINR: "₹85", resellerPrice: "₹39", priceUSD: "$1.38" },
      { duration: "7 day", priceINR: "₹320", resellerPrice: "₹145", priceUSD: "$3.75" },
      { duration: "15 day", priceINR: "₹590", resellerPrice: "₹290", priceUSD: "$6.90" },
      { duration: "31 day", priceINR: "₹1019", resellerPrice: "₹480", priceUSD: "$9.80" },
    ],
    updateChannel: "https://t.me/+fy2vh_LXjJs4ODk9",
    features: ["ᴀɪᴍ ᴍᴀɢɴᴇᴛ", "ꜱɪʟᴇɴᴛ ᴀɪᴍ", "ᴀɪᴍʙᴏᴛ ʟᴇɢɪᴛ", "ꜱᴘᴇᴇᴅ ᴛɪᴍᴇʀ", "ɢʜᴏꜱᴛ ʜᴀᴄᴋ", "ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ", "🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ", "ɴᴏɴ ʀᴏᴏᴛ ᴍᴏʙɪʟᴇ", "ʀᴀɴᴋ ᴘᴜꜱʜ ᴘᴜʀᴘᴏꜱᴇ"],
  },

  {
    id: "hg-cheats-mobile",
    name: "HG CHEATS MOBILE NON ROOT",
    fulfillmentType: "LOCAL",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/HG%20NON%20ROOT%20PANEL.mp4",
    category: "mobile",
    prices: [
      { duration: "1 day", resellerPrice: "₹45", priceINR: "₹60" },
      { duration: "10 day", resellerPrice: "₹149", priceINR: "₹320" },
      { duration: "31 day", resellerPrice: "₹299", priceINR: "₹550" },
    ],
    updateChannel: "https://t.me/+lzOZzChCQmE3ZmQ1",
    features: ["ᴀɪᴍᴋɪʟʟ", "ꜱᴘᴇᴇᴅ ʜᴀᴄᴋ", "ᴀɴᴛɪ-ᴛᴇʟᴇᴘᴏʀᴛ", "ʜᴇᴀᴅꜱʜᴏᴛ ʜᴀᴄᴋ", "ᴀɪᴍ ᴠɪꜱɪʙʟᴇ", "ᴀɪᴍꜰᴏᴠ 180°", "ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ", "🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ", "ʀᴀɴᴋ ᴘᴜꜱʜ ᴘᴜʀᴘᴏꜱᴇ", "ɴᴏɴ ʀᴏᴏᴛ"],
  },

  {
    id: "haxx-cker-pro",
    name: "HAXX-CKER PRO FF ROOT",
    fulfillmentType: "API",
    sellerPid: "64",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/haxx%20pro.MOV",
    category: "mobile",
    prices: [
      { duration: "3 day", resellerPrice: "₹np", priceINR: "₹249", sellerDuration: "3 Days" },
      { duration: "5 day", resellerPrice: "₹np", priceINR: "₹399", sellerDuration: "5 Days" },
      { duration: "10 day", resellerPrice: "₹np", priceINR: "₹549", sellerDuration: "10 Days" },
      { duration: "20 day", resellerPrice: "₹np", priceINR: "₹1049", sellerDuration: "20 Days" },
      { duration: "30 day", resellerPrice: "₹np", priceINR: "₹1449", sellerDuration: "30 Days" },
      { duration: "60 day", resellerPrice: "₹np", priceINR: "₹2799", sellerDuration: "60 Days" },
      { duration: "120 day", resellerPrice: "₹np", priceINR: "₹5449" },
    ],
    updateChannel: "https://t.me/+1bfn34OibsAyODc1",
    features: ["Headshot Hack", "AimFov 360°", "Esp Line Location", "Stream Mode", "🄲🅂 / 🄱🅁 ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ", "root support", "non root (virtual - vphone)"],
  },
];

export const pcProducts: Product[] = [
  {
    id: "br-mod-pc-aim",
    name: "BR MOD PC AIM SILENT ( MAIN ID )",
    fulfillmentType: "LOCAL",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/BR%20MOD%20PC%20PANEL.mp4",
    category: "pc",
    prices: [
      { duration: "1 day", priceINR: "₹85", resellerPrice: "₹48", priceUSD: "$1.40" },
      { duration: "10 day", priceINR: "₹435", resellerPrice: "₹245", priceUSD: "$5.30" },
      { duration: "31 day", priceINR: "₹825", resellerPrice: "₹490", priceUSD: "$8.95" },
    ],
    updateChannel: "https://t.me/+vNW83oEZIzw3Y2Fl",
    features: ["⛨ ᴀɪᴍʙᴏᴛ ʟɪᴛᴇ", "⛨ ᴀɪᴍꜰᴏᴠ 1200°", "⛨ ɢʜᴏꜱᴛ", "⛨ ᴜɴᴅᴇʀ ᴄᴀʀ", "⛨ ᴛᴇʟᴇᴘᴏʀᴛ ᴡᴀʟʟ ᴄꜱ", "⛨ ᴛᴇʟᴇᴘᴏʀᴛ ᴡᴀʟʟ ʙʀ", "⛨ ꜱᴘᴇᴇᴅ ʜᴀᴄᴋ", "⛨ ɢʜᴏꜱᴛ ꜱʏɴᴄ", "⛨ ᴡᴀʟʟ ʜᴀᴄᴋ", "⛨ ꜱᴄʀᴇᴇɴ ꜱᴛᴏᴘ", "⛨ ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ", "⛨ ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ", "MAIN ID FULL SAFE"],
  },

  {
    id: "basic-customized-pc",
    name: "BASIC CUSTOMIZED PC PANEL ( MAIN ID )",
    fulfillmentType: "LOCAL",
    videoUrl: "https://res.cloudinary.com/dda4gh2wm/video/upload/q_auto/f_auto/v1780157629/BASIC_PC_PANEL_wuorib.mp4",
    category: "pc",
    prices: [
      { duration: "1 day", resellerPrice: "₹30", priceINR: "₹65" },
      { duration: "15 day", resellerPrice: "₹255", priceINR: "₹559" },
      { duration: "31 day", resellerPrice: "₹489", priceINR: "₹1099" },
      { duration: "Lifetime", resellerPrice: "₹1300", priceINR: "₹1999" },
    ],
    updateChannel: "https://t.me/jprimeallcustompcpanel",
    features: ["☉ ᴀɪᴍʙᴏᴛ ɢʟᴏʙᴀʟ", "☉ ᴀɪᴍʙᴏᴛ ᴇxᴛᴇʀɴᴀʟ", "☉ ꜱɴɪᴘᴇʀ ꜱᴡɪᴛᴄʜ", "☉ ꜱɴɪᴘᴇʀ ꜱᴄᴏᴘᴇ", "☉ ɢʟɪᴛᴄʜ ꜰɪʀᴇ", "☉ ᴇꜱᴘ ʟɪɴᴇ ʙᴏx", "☉ ᴇꜱᴘ ᴀʟᴇʀᴛ", "☉ ᴇꜱᴘ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ ᴡᴇᴀᴘᴏɴ", "☉ ᴀᴜᴛᴏ ʀᴇꜰʀᴇꜱʜ", "☉ ꜱᴛʀᴇᴀᴍᴇʀ ᴍᴏᴅᴇ"],
  },

  {
    id: "brutal-haxxcer-pc",
    name: "AIM SILENT EXE - HAXXCKER CLIENT",
    fulfillmentType: "LOCAL",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/haxx%20silent.mp4",
    category: "pc",
    prices: [
      { duration: "1 day", resellerPrice: "₹30", priceINR: "₹65" },
      { duration: "15 day", resellerPrice: "₹255", priceINR: "₹559" },
      { duration: "31 day", resellerPrice: "₹489", priceINR: "₹1099" },
      { duration: "Lifetime", resellerPrice: "₹1300", priceINR: "₹1999" },
    ],
    updateChannel: "https://t.me/+F8nTtUENXi9mYmY1",
    features: ["⛨ ᴀɪᴍ ᴅᴏᴡɴᴋɪʟʟ", "⛨ ᴀɪᴍꜰᴏᴠ 1200°", "⛨ ᴜᴘ ᴘʟᴀʏᴇʀ", "⛨ ᴛᴇʟᴇ ᴋɪʟʟ 10ᴍ", "⛨ᴛᴇʟᴇᴘᴏʀᴛ ʜᴀᴄᴋ ᴄꜱ", "⛨ᴛᴇʟᴇᴘᴏʀᴛ ʜᴀᴄᴋ ʙʀ", "⛨ ᴍᴇᴅᴋɪᴛ ʀᴜɴ", "⛨ ꜱᴘᴇᴇᴅ ʜᴀᴄᴋ ᴊᴏyꜱᴛɪᴄᴋ", "⛨ ᴄʟɪᴍʙ ᴜᴘ", "⛨ ɴᴏ ʀᴇᴄᴏɪʟ", "⛨ ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ", "⛨ ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ"],
  },

  {
    id: "brutal-customized-pc",
    name: "AIM COVER PANEL ( Rank push )",
    fulfillmentType: "LOCAL",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/AIM%20COVER%20PC.mp4",
    category: "pc",
    prices: [
      { duration: "1 day", resellerPrice: "₹30", priceINR: "₹65" },
      { duration: "15 day", resellerPrice: "₹255", priceINR: "₹559" },
      { duration: "31 day", resellerPrice: "₹489", priceINR: "₹1099" },
      { duration: "Lifetime", resellerPrice: "₹1300", priceINR: "₹1999" },
    ],
    updateChannel: "https://t.me/jprimeallcustompcpanel",
    features: ["⛨ ᴀɪᴍ ᴅᴏᴡɴᴋɪʟʟ", "⛨ ᴀɪᴍꜰᴏᴠ 1200°", "⛨ ᴜᴘ ᴘʟᴀʏᴇʀ", "⛨ ᴛᴇʟᴇ ᴋɪʟʟ 10ᴍ", "⛨ᴛᴇʟᴇᴘᴏʀᴛ ʜᴀᴄᴋ ᴄꜱ", "⛨ᴛᴇʟᴇᴘᴏʀᴛ ʜᴀᴄᴋ ʙʀ", "⛨ ᴍᴇᴅᴋɪᴛ ʀᴜɴ", "⛨ ꜱᴘᴇᴇᴅ ʜᴀᴄᴋ ᴊᴏyꜱᴛɪᴄᴋ", "⛨ ᴄʟɪᴍʙ ᴜᴘ", "⛨ ɴᴏ ʀᴇᴄᴏɪʟ", "⛨ ᴀᴜᴛᴏ ꜱᴡɪᴛᴄʜ", "⛨ ꜰᴀꜱᴛ ꜱᴡɪᴛᴄʜ", "⛨ ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ", "⛨ ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ"],
  },

  {
    id: "brutal-customized-aim-kill-pc",
    name: "AIM KILL PANEL ( Rank push )",
    fulfillmentType: "LOCAL",
    videoUrl: "https://vukdpfogrmaqxhbnljbs.supabase.co/storage/v1/object/public/demo-videos/akill.mp4",
    category: "pc",
    prices: [
      { duration: "1 day", resellerPrice: "₹30", priceINR: "₹85" },
      { duration: "15 day", resellerPrice: "₹255", priceINR: "₹569" },
      { duration: "31 day", resellerPrice: "₹489", priceINR: "₹1199" },
      { duration: "Lifetime", resellerPrice: "₹1400", priceINR: "₹2199" },
    ],
    updateChannel: "https://t.me/jprimeallcustompcpanel",
    features: ["⛨ ᴀɪᴍ ᴅᴏᴡɴᴋɪʟʟ", "⛨ ᴀɪᴍꜰᴏᴠ 1200°", "⛨ ᴜᴘ ᴘʟᴀʏᴇʀ", "⛨ ᴛᴇʟᴇ ᴋɪʟʟ 10ᴍ", "⛨ᴛᴇʟᴇᴘᴏʀᴛ ʜᴀᴄᴋ ᴄꜱ", "⛨ᴛᴇʟᴇᴘᴏʀᴛ ʜᴀᴄᴋ ʙʀ", "⛨ ᴍᴇᴅᴋɪᴛ ʀᴜɴ", "⛨ ꜱᴘᴇᴇᴅ ʜᴀᴄᴋ ᴊᴏyꜱᴛɪᴄᴋ", "⛨ ᴄʟɪᴍʙ ᴜᴘ", "⛨ ɴᴏ ʀᴇᴄᴏɪʟ", "⛨ ᴀᴜᴛᴏ ꜱᴡɪᴛᴄʜ", "⛨ ꜰᴀꜱᴛ ꜱᴡɪᴛᴄʜ", "⛨ ᴇꜱᴘ ʟɪɴᴇ ʟᴏᴄᴀᴛɪᴏɴ", "⛨ ʀᴀɴᴋ ᴡᴏʀᴋɪɴɢ"],
  },
];

export const allProducts: Product[] = [
  ...mobileProducts,
  ...pcProducts,
];