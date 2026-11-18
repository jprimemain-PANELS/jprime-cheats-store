import { NextRequest, NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/auth";
import { getStoreOptions } from "@/lib/store-options";
import { listSubStores } from "@/lib/subscription";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/** A co-admin whose owner chose "their own web": the sub-stores their resellers launched. Own children only. */
export async function GET(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  if (auth.tenant.kind !== "coadmin") return NextResponse.json({ success: true, enabled: false, stores: [] }, { headers: NO_STORE });
  const o = await getStoreOptions(auth.tenant.id);
  const enabled = o.resellerLaunch === true && o.launchMode === "own";
  return NextResponse.json({ success: true, enabled, stores: enabled ? await listSubStores(auth.tenant.id) : [] }, { headers: NO_STORE });
}
