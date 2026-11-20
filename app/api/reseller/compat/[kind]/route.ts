import { NextRequest } from "next/server";
import { authenticate, json, readBody } from "../../_auth";
import { buyByPid, listItems, masterOk, walletBalance } from "@/lib/reseller-api";

export const dynamic = "force-dynamic";

/**
 * Compatibility endpoints. A bot or website that is already built for one of the common seller APIs only changes the
 * base URL + key + product ids; request and response shapes are the same style it already understands.
 *   /api/reseller/compat/s1   form: api_key (+ optional x-master-key header), action=buy|balance|products|stock, product_id [+ duration]        -> { status:"success", data:{ key } }
 *   /api/reseller/compat/s2   header X-API-Token, form: variant_id, quantity=1                      -> { success:true, keys:[key] }
 *   /api/reseller/compat/s3   header Authorization: Bearer, JSON: product_id, quantity, idempotency_key -> { ok:true, data:{ keys:[key] } }
 * The "product id" in all three styles is the numeric Product ID from the API tab / products list.
 */
async function entry(request: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (kind !== "s1" && kind !== "s2" && kind !== "s3") return json({ success: false, error: "Not found." }, 404);
  const body = await readBody(request);
  const get = (k: string) => body[k] ?? request.nextUrl.searchParams.get(k);
  const fail = (msg: string, status: number) =>
    kind === "s1" ? json({ status: "error", msg }, status) : kind === "s2" ? json({ success: false, error: msg }, status) : json({ ok: false, error: { message: msg } }, status);

  const a = await authenticate(request, body);
  if (!a.ok) return fail(a.error, a.status);
  const { tenant, username } = a;
  try {
    // Style 1 bots always send a master key (header x-master-key or field master_key). Empty is fine; a wrong one is refused.
    if (kind === "s1" && !masterOk(a.masterHash, request.headers.get("x-master-key") ?? get("master_key"))) return fail("Invalid master key.", 401);
    const action = String(get("action") ?? (kind === "s1" ? "" : "buy")).toLowerCase();
    if (action === "balance") {
      const balance = await walletBalance(tenant.id, username);
      return kind === "s1" ? json({ status: "success", data: { balance } }) : kind === "s2" ? json({ success: true, balance }) : json({ ok: true, data: { balance } });
    }
    if (action === "products" || action === "stock") {
      const items = await listItems(tenant.id, username);
      const pid = Number(get("product_id") ?? get("variant_id"));
      const list = action === "stock" && pid ? items.filter((i) => i.product_id === pid) : items;
      return kind === "s1" ? json({ status: "success", data: list }) : kind === "s2" ? json({ success: true, products: list }) : json({ ok: true, data: { products: list } });
    }
    if (action !== "buy") return fail("Unknown action.", 400);

    const qty = Number(get("quantity") ?? 1);
    if (!Number.isInteger(qty) || qty !== 1) return fail("quantity must be 1.", 400);
    let pid: unknown = get("product_id") ?? get("variant_id");
    // Style 1 sends product_id + duration: product_id may be the product's Group ID with the duration (text, number or position) picking the plan.
    const dur = String(get("duration") ?? "").trim().toLowerCase();
    if (kind === "s1" && dur) {
      const items = await listItems(tenant.id, username);
      const group = items.filter((i) => i.group_id === Number(pid));
      if (group.length) {
        const hit = group.find((i) => i.duration.toLowerCase() === dur) ?? group.find((i) => String(i.product_id) === dur) ?? group[Number(dur) - 1];
        if (!hit) return fail("Unknown duration for this product.", 400);
        pid = hit.product_id;
      }
    }
    const r = await buyByPid(tenant.id, username, pid, get("idempotency_key") ?? request.headers.get("idempotency-key"));
    if (!r.ok) return fail(r.error, r.status);
    return kind === "s1" ? json({ status: "success", data: { key: r.key, order_id: r.order, price: r.price, balance: r.balance } })
      : kind === "s2" ? json({ success: true, keys: [r.key], order_id: r.order, balance: r.balance })
      : json({ ok: true, data: { keys: [r.key], order_id: r.order, price: r.price, balance: r.balance } });
  } catch (e) {
    console.error("RESELLER COMPAT ERROR:", e instanceof Error ? e.message : "unknown");
    return fail("Request failed.", 500);
  }
}
export const GET = entry, POST = entry;
