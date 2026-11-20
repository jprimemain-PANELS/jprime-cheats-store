import { NextRequest, NextResponse } from "next/server";
import { requireUser, rateLimit, normalizeRole } from "@/lib/auth";
import { generateKey, getKeyInfo, listItems, revokeKey, walletBalance } from "@/lib/reseller-api";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const out = (b: Record<string, unknown>, status = 200) => NextResponse.json(b, { status, headers: NO_STORE });

/** The API tab on the home page (logged-in resellers only): key status, products with Product IDs, wallet. */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (normalizeRole(auth.user.role) !== "reseller") return out({ success: false, error: "Only resellers can use the API." }, 403);
  const { username } = auth.user; const tenantId = auth.tenant.id;
  if (!rateLimit(`rapi-panel:${tenantId}:${username}`, 40, 60_000)) return out({ success: false, error: "Too many requests." }, 429);
  const [key, items, balance] = await Promise.all([getKeyInfo(tenantId, username), listItems(tenantId, username), walletBalance(tenantId, username)]);
  return out({ success: true, key, items, balance });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (normalizeRole(auth.user.role) !== "reseller") return out({ success: false, error: "Only resellers can use the API." }, 403);
  const { username } = auth.user; const tenantId = auth.tenant.id;
  if (!rateLimit(`rapi-keygen:${tenantId}:${username}`, 8, 60_000)) return out({ success: false, error: "Too many requests." }, 429);
  const b = await request.json().catch(() => ({}));
  if (b?.action === "generate") { const r = await generateKey(tenantId, username); return r.ok ? out({ success: true, key: r.key }) : out({ success: false, error: r.error }, 500); }
  if (b?.action === "revoke") return (await revokeKey(tenantId, username)) ? out({ success: true }) : out({ success: false, error: "Could not revoke." }, 500);
  return out({ success: false, error: "Unknown action." }, 400);
}
