import { NextRequest, NextResponse } from "next/server";
import { rateLimit, requireTenantAdmin } from "@/lib/auth";
import {
  SELLERS, approvedSellers, createConnection, deleteConnection, jprimeAccess, jprimeCatalog, listConnections,
  ownerDecide, ownerListConnections, updateConnectionKeys,
} from "@/lib/api-system";
import { subscriptionState } from "@/lib/subscription";
import { OWNER_TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO_STORE });
const isUuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * API SYSTEM. Store admin only; the store is ALWAYS the one in the verified host + session.
 *  owner store   -> sees your two sellers and every store's requests (with the details you need to build them)
 *  co-admin store-> sees its own cards. Keys come back masked. ?for=products returns what the product form needs.
 */
export async function GET(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;

  if (auth.tenant.id === OWNER_TENANT_ID) {
    const o = await ownerListConnections();
    const env1 = !!(process.env.RESELLER_API_KEY && process.env.RESELLER_MASTER_KEY);
    const env2 = !!process.env.SELLER2_API_TOKEN;
    return NextResponse.json({
      success: true, owner: true, available: o.available, requests: o.items,
      sellers: [
        { id: "SELLER1", name: SELLERS.SELLER1.name, connected: env1, stores: o.items.filter((x) => x.status === "approved" && x.assignedSeller === "SELLER1").length },
        { id: "SELLER2", name: SELLERS.SELLER2.name, connected: env2, stores: o.items.filter((x) => x.status === "approved" && x.assignedSeller === "SELLER2").length },
      ],
    }, { headers: NO_STORE });
  }

  const access = await jprimeAccess(auth.tenant.id);
  if (request.nextUrl.searchParams.get("for") === "products") {
    return NextResponse.json({
      success: true, jprimeAllowed: access.allowed,
      sellers: await approvedSellers(auth.tenant.id),
      catalog: access.allowed ? await jprimeCatalog() : [],
    }, { headers: NO_STORE });
  }
  const [conns, sub] = await Promise.all([listConnections(auth.tenant.id), subscriptionState(auth.tenant.id)]);
  return NextResponse.json({
    success: true, owner: false, available: conns.available, connections: conns.items,
    sellers: Object.entries(SELLERS).map(([id, s]) => ({ id, name: s.name })),
    jprime: { allowed: access.allowed, sharedStockOn: auth.tenant.sharedStockAllowed, walletLinked: !!access.payer, walletBalance: sub.walletBalance },
  }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  if (!rateLimit(`api-sys:${auth.user.username}:${auth.tenant.id}`, 30, 60_000)) return fail("Too many requests.", 429);
  const b = await request.json().catch(() => ({}));
  const actor = { id: auth.user.id, username: auth.user.username };
  const action = String(b?.action ?? "");

  if (auth.tenant.id === OWNER_TENANT_ID) {
    if (action !== "decide") return fail("Unknown action.");
    if (!isUuid(b?.id)) return fail("Invalid id.");
    const r = await ownerDecide(b.id, b?.decision, b?.assignedSeller, b?.note, actor);
    return r.ok ? NextResponse.json({ success: true }, { headers: NO_STORE }) : fail(r.error);
  }

  let r: any;
  if (action === "create") r = await createConnection(auth.tenant, actor, b);
  else if (action === "keys") { if (!isUuid(b?.id)) return fail("Invalid id."); r = await updateConnectionKeys(auth.tenant, actor, b.id, b); }
  else if (action === "delete") { if (!isUuid(b?.id)) return fail("Invalid id."); r = await deleteConnection(auth.tenant, actor, b.id); }
  else return fail("Unknown action.");
  return r.ok ? NextResponse.json({ success: true }, { headers: NO_STORE }) : fail(r.error);
}
