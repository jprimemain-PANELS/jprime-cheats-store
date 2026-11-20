import { NextRequest } from "next/server";
import { authenticate, json, readBody } from "../../_auth";
import { buyByPid, listItems, listOrders, walletBalance } from "@/lib/reseller-api";

export const dynamic = "force-dynamic";

/**
 * Reseller API (native JSON). Header: Authorization: Bearer rk_...   (also X-API-Key / X-API-Token / ?api_key=)
 *   GET  /api/reseller/v1/balance
 *   GET  /api/reseller/v1/products            ?category=mobile  ?q=search
 *   GET  /api/reseller/v1/stock?product_id=1001
 *   POST /api/reseller/v1/buy                 { product_id, idempotency_key? }  -> { key, order, price, balance }
 *   GET  /api/reseller/v1/orders
 */
async function entry(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const body = await readBody(request);
  const a = await authenticate(request, body);
  if (!a.ok) return json({ success: false, error: a.error }, a.status);
  const { tenant, username } = a;
  const [route] = (await ctx.params).path ?? [];
  const sp = request.nextUrl.searchParams;
  try {
    if (route === "balance" && request.method === "GET") return json({ success: true, balance: await walletBalance(tenant.id, username), currency: "INR" });
    if (route === "products" && request.method === "GET") {
      let items = await listItems(tenant.id, username);
      const cat = sp.get("category"); const q = (sp.get("q") || "").trim().toLowerCase();
      if (cat) items = items.filter((i) => i.category === cat);
      if (q) items = items.filter((i) => `${i.product} ${i.duration}`.toLowerCase().includes(q));
      return json({ success: true, count: items.length, products: items });
    }
    if (route === "stock" && request.method === "GET") {
      const pid = Number(sp.get("product_id"));
      const it = (await listItems(tenant.id, username)).find((i) => i.product_id === pid);
      return it ? json({ success: true, product_id: it.product_id, in_stock: it.in_stock, stock: it.stock, status: it.status }) : json({ success: false, error: "Unknown product_id." }, 404);
    }
    if (route === "buy" && request.method === "POST") {
      const r = await buyByPid(tenant.id, username, body.product_id, body.idempotency_key ?? request.headers.get("idempotency-key"));
      return r.ok ? json({ success: true, key: r.key, order: r.order, product: r.product, duration: r.duration, price: r.price, balance: r.balance, ...(r.duplicate ? { duplicate: true } : {}) }, r.duplicate ? 200 : 201) : json({ success: false, error: r.error, ...(r.balance !== undefined ? { balance: r.balance } : {}) }, r.status);
    }
    if (route === "orders" && request.method === "GET") return json({ success: true, orders: await listOrders(tenant.id, username) });
    return json({ success: false, error: "Not found." }, 404);
  } catch (e) {
    console.error("RESELLER API ERROR:", e instanceof Error ? e.message : "unknown");
    return json({ success: false, error: "Request failed." }, 500);
  }
}
export const GET = entry, POST = entry;
