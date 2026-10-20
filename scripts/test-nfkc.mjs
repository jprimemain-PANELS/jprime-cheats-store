const bold = "\u{1D5D4}\u{1D5E1}\u{1D5DA}\u{1D5E7}\u{1D5E4} \u{1D5D8}\u{1D5DE}\u{1D5D3} - ROOT MOBILE";
const plain = "ANGRY MOD - ROOT MOBILE";

function normalizeProductName(name) {
  return String(name ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

console.log("bold norm:", normalizeProductName(bold));
console.log("plain norm:", normalizeProductName(plain));
console.log("match:", normalizeProductName(bold) === normalizeProductName(plain));
