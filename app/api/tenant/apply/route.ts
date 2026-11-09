import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, requireUser } from "@/lib/auth";
import { myApplication, submitApplication } from "@/lib/tenant-admin";
import { launchOptions, launchStore } from "@/lib/subscription";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status, headers: NO_STORE });

/** GET -> my latest application (status only; never the password hash). */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const eligible = ["reseller", "vip_reseller", "vip reseller", "vip"].includes(auth.user.role);
  return NextResponse.json(
    { success: true, eligible, application: await myApplication(auth.user, auth.tenant), options: await launchOptions() },
    { headers: NO_STORE }
  );
}

/** POST -> submit a pending application. Reseller-only. The tenant is the verified current store, never the body. */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (!rateLimit(`apply:${auth.user.username}:${auth.tenant.id}`, 5, 60 * 60_000) || !rateLimit(`apply:ip:${clientIp(request)}`, 15, 60 * 60_000)) {
    return fail("Too many attempts. Try again later.", 429);
  }
  const b = await request.json().catch(() => ({}));

  // Instant launch (no approval) when the platform is ready for it; otherwise fall back to the old "apply" flow.
  if ((await launchOptions()).selfService) {
    const l = await launchStore({ id: auth.user.id, tenantId: auth.user.tenantId, role: auth.user.role, username: auth.user.username }, auth.tenant, {
      brandName: b?.brandName, slug: String(b?.slug ?? "").trim().toLowerCase(), telegramUsername: b?.telegramUsername,
      contactEmail: b?.contactEmail, contactPhone: b?.contactPhone, coadminUsername: b?.coadminUsername, coadminPassword: b?.coadminPassword,
      domainChoice: b?.domainChoice === "custom" ? "custom" : "free", customDomain: b?.customDomain,
    });
    return l.ok
      ? NextResponse.json({ success: true, launched: true, url: l.url, expiresAt: l.expiresAt, custom: l.custom }, { headers: NO_STORE })
      : fail(l.error, l.status);
  }
  const r = await submitApplication(auth.user, auth.tenant, {
    brandName: b?.brandName, slug: b?.slug, telegramUsername: b?.telegramUsername, inventoryMode: b?.inventoryMode,
    contactEmail: b?.contactEmail, contactPhone: b?.contactPhone, coadminUsername: b?.coadminUsername, coadminPassword: b?.coadminPassword,
  });
  return r.ok ? NextResponse.json({ success: true }, { headers: NO_STORE }) : fail(r.error, r.status);
}
