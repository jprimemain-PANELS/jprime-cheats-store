import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { SessionTimeout } from '@/components/session-timeout'
import { BrandProvider } from '@/components/brand-provider'
import { OWNER_BRAND, DEFAULT_LAYOUT, type Brand } from '@/lib/brand'
import { StoreNotFound } from '@/components/store-not-found'
import { StoreMoved } from '@/components/store-moved'
import { movedTo } from '@/lib/domains'
import { headers } from 'next/headers'
import { currentTenant } from '@/lib/tenant'
import { publicBrand } from '@/lib/tenant-admin'
import { buildThemeCss } from '@/lib/theme'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

async function loadBrand() {
  const tenant = await currentTenant();
  if (!tenant) return null;
  try {
    const pb = await publicBrand(tenant);
    const brand: Brand = tenant.kind === "owner"
      ? { ...OWNER_BRAND, announcement: pb.theme?.announcement ?? "", tagline: pb.theme?.tagline ?? "", footerText: pb.theme?.footerText ?? "" }
      : {
          name: pb.name, isOwner: false, telegram: pb.telegram, logoUrl: pb.theme?.logoUrl ?? "",
          tagline: pb.theme?.tagline ?? "", announcement: pb.theme?.announcement ?? "", footerText: pb.theme?.footerText ?? "",
          layout: pb.theme ? {
            heroLayout: pb.theme.heroLayout, heroTitle: pb.theme.heroTitle, heroSubtitle: pb.theme.heroSubtitle,
            heroImageUrl: pb.theme.heroImageUrl, loginCharacterUrl: pb.theme.loginCharacterUrl, loginPetUrl: pb.theme.loginPetUrl, loginCard: pb.theme.loginCard, loginBg: pb.theme.loginBg, ctaText: pb.theme.ctaText, columns: pb.theme.columns, showStats: pb.theme.showStats,
          } : DEFAULT_LAYOUT,
        };
    return { tenant, brand, css: pb.theme ? buildThemeCss(pb.theme) : "" };
  } catch {
    // Branding lookup failed: still serve the store (owner keeps its look; co-admin gets its name, default theme)
    return {
      tenant,
      brand: tenant.kind === "owner" ? OWNER_BRAND : { ...OWNER_BRAND, name: tenant.brandName, isOwner: false, telegram: tenant.telegramUsername },
      css: "",
    };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const loaded = await loadBrand();
  if (loaded && !loaded.brand.isOwner) {
    return { title: loaded.brand.name, description: loaded.brand.tagline || `${loaded.brand.name} - digital store` };
  }
  return {
    title: 'JPRIME CHEATS STORE | Premium FF Panel Purchase',
    description: 'Premium FF Panel Purchase - Mobile, PC & iOS Gaming Solutions',
    icons: { icon: "/favicon.ico", shortcut: "/favicon.ico", apple: "/icon.png" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const loaded = await loadBrand();
  if (!loaded) {
    return (
      <html lang="en" className="dark bg-background" suppressHydrationWarning>
        <body suppressHydrationWarning><StoreNotFound /></body>
      </html>
    );
  }
  if (loaded.tenant.kind === "coadmin") {
    const h = await headers();
    const to = await movedTo(loaded.tenant.id, h.get("host") || h.get("x-forwarded-host") || "");
    if (to) {
      return (
        <html lang="en" className="dark bg-background" suppressHydrationWarning>
          <body suppressHydrationWarning><StoreMoved name={loaded.brand.name} to={to} /></body>
        </html>
      );
    }
  }
  return (
    <html lang="en" className="dark bg-background" suppressHydrationWarning>
      <head>{loaded.css ? <style id="store-theme" dangerouslySetInnerHTML={{ __html: loaded.css }} /> : null}</head>
      <body className="font-sans antialiased bg-background text-foreground" suppressHydrationWarning>
        <BrandProvider brand={loaded.brand}>
          <SessionTimeout />
          {children}
        </BrandProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
