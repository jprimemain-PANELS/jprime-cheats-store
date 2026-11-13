import { NextResponse } from "next/server";
import { currentTenant } from "@/lib/tenant";
import { publicBrand } from "@/lib/tenant-admin";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[<>&"']/g, "");

/** Store icon for browser tab / home-screen shortcut. A co-admin store never shows the main JPRIME logo:
 *  it gets its own logo if set, otherwise a clean letter icon in its brand color. */
export async function GET() {
  const tenant = await currentTenant();
  let name = "Store", color = "#6366f1", logo = "";
  if (tenant) {
    try {
      const pb = await publicBrand(tenant);
      name = pb.name || tenant.brandName || name;
      color = /^#[0-9a-fA-F]{6}$/.test(pb.theme?.primary || "") ? pb.theme!.primary : color;
      logo = pb.theme?.logoUrl || "";
    } catch { name = tenant.brandName || name; }
  }
  if (/^https:\/\//.test(logo)) {
    return NextResponse.redirect(logo, { status: 302, headers: { "Cache-Control": "public, max-age=300" } });
  }
  const letter = esc(Array.from(name.trim())[0]?.toUpperCase() || "S");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><text x="32" y="44" font-family="Arial,Helvetica,sans-serif" font-size="36" font-weight="700" text-anchor="middle" fill="#fff">${letter}</text></svg>`;
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300" } });
}
