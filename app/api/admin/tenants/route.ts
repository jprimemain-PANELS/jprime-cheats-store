import { NextRequest, NextResponse } from "next/server";
import { rateLimit, requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/tenant-db";
import {
  approveApplication, createStoreDirect, ownerOverview, rejectApplication, setSharedStockAllowed, setStoreStatus,
  setStorePayer,
} from "@/lib/tenant-admin";
import { ownerResetStoreAdmin } from "@/lib/user-admin";
import { deleteStore, activateCustomDomain, ownerDomainInfo, ownerRemoveCustomDomain, setCustomDomainAllowed } from "@/lib/domains";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO_STORE });

/** OWNER ONLY. A co-admin (or an "admin" role inside another store) gets 403 from requireAdmin. */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const [ov, domainInfo] = await Promise.all([ownerOverview(), ownerDomainInfo()]);
    return NextResponse.json({ success: true, ...ov, domainInfo }, { headers: NO_STORE });
  } catch {
    return fail("Could not load stores.", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  if (!rateLimit(`admin-tenants:${auth.user.username}`, 60, 60_000)) return fail("Too many requests.", 429);

  const b = await request.json().catch(() => ({}));
  const action = String(b?.action ?? "");
  const actor = { id: auth.user.id, username: auth.user.username };
  const id = String(b?.id ?? "");
  let result: any;

  switch (action) {
    case "approve": if (!isUuid(id)) return fail("Invalid id."); result = await approveApplication(id, actor); break;
    case "reject": if (!isUuid(id)) return fail("Invalid id."); result = await rejectApplication(id, b?.note, actor); break;
    case "suspend":
    case "reactivate":
      if (!isUuid(id)) return fail("Invalid id.");
      result = await setStoreStatus(id, action === "suspend" ? "suspended" : "active", String(b?.reason ?? ""), actor);
      break;
    case "shared_stock":
      if (!isUuid(id)) return fail("Invalid id.");
      result = await setSharedStockAllowed(id, b?.allowed === true, actor);
      break;
    case "set_payer":
      if (!isUuid(id)) return fail("Invalid id.");
      result = await setStorePayer(id, String(b?.username ?? ""), actor);
      break;
    case "reset_store_admin":
      if (!isUuid(id)) return fail("Invalid id.");
      result = await ownerResetStoreAdmin(id, actor);
      break;
    case "delete_store":
      if (!isUuid(id)) return fail("Invalid id.");
      result = await deleteStore(id, String(b?.confirm ?? ""), actor);
      break;
    case "custom_allowed":
      if (!isUuid(id)) return fail("Invalid id.");
      result = await setCustomDomainAllowed(id, b?.allowed === true, actor);
      break;
    case "domain_activate":
      result = await activateCustomDomain(String(b?.host ?? ""), b?.addedInVercel === true, actor);
      break;
    case "domain_remove":
      result = await ownerRemoveCustomDomain(String(b?.host ?? ""), actor);
      break;
    case "create":
      result = await createStoreDirect({
        brandName: b?.brandName, slug: String(b?.slug ?? "").toLowerCase(), telegram: b?.telegram, inventoryMode: b?.inventoryMode,
        username: String(b?.username ?? "").trim(), password: String(b?.password ?? ""), email: b?.email, phone: b?.phone,
      }, actor);
      break;
    default: return fail("Unknown action.");
  }
  if (!result?.ok) return fail(String(result?.reason || "Failed."), 400);
  return NextResponse.json({ success: true, ...result }, { headers: NO_STORE });
}
