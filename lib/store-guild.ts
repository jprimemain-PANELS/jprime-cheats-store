import { tdb } from "@/lib/tenant-db";
import { OWNER_TENANT_ID } from "@/lib/tenant";
import { ownerGuildCreds, creditsOfPlan, type GuildCreds } from "@/lib/guild-glory";
import { jprimeAccess, payerPricing } from "@/lib/api-system";

/**
 * Guild Glory for CO-ADMIN stores runs on the OWNER's seller account (like JPRIME API stock): the store never holds a seller key.
 * Each group a customer launches costs the store's linked "payer" wallet on the main site the owner's price for one token
 * (reseller price, or a VIP price the owner set). Allowed only when the same conditions as JPRIME API stock are met
 * (store active + payer wallet linked). Server only.
 */

/** Credentials for one store (null = not connected / not allowed). */
export async function loadGuildCreds(tenantId: string): Promise<GuildCreds> {
  if (tenantId === OWNER_TENANT_ID) return ownerGuildCreds();
  const access = await jprimeAccess(tenantId);
  return access.allowed ? ownerGuildCreds() : null;
}

const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : 0; };

/** What ONE group costs this payer: the owner's Guild product, the 1-token plan (or the cheapest per-token plan), with the owner's price edits and the payer's own prices applied. */
export async function guildCostPerGroup(payer: string | null | undefined): Promise<number> {
  const cat = await tdb(OWNER_TENANT_ID).from("products_catalog").select("name, data");
  if (cat.error) return 0;
  const row = ((cat.data as any[]) ?? []).find((r) => r?.data?.kind === "guild");
  if (!row) return 0;
  const name = String(row.name ?? row.data?.name ?? "").trim();
  const tiers: any[] = Array.isArray(row.data?.prices) ? row.data.prices : [];
  const [pr, ov] = await Promise.all([
    payerPricing(payer),
    tdb(OWNER_TENANT_ID).from("product_prices").select("duration, price_inr, reseller_price").eq("product_name", name),
  ]);
  const over = new Map<string, any>(((ov.data as any[]) ?? []).map((o) => [String(o.duration ?? "").trim(), o]));
  let best = 0;
  for (const t of tiers) {
    const dur = String(t?.duration ?? "").trim();
    const credits = creditsOfPlan(dur);
    if (!credits) continue;
    const o = over.get(dur);
    const retail = Number(o?.price_inr) > 0 ? Number(o.price_inr) : num(t?.priceINR);
    const resell = Number(o?.reseller_price) > 0 ? Number(o.reseller_price) : num(t?.resellerPrice);
    const own = pr.overrides.get(`${name}|${dur}`);
    const total = own || (pr.reseller ? resell || retail : retail);
    if (!(total > 0)) continue;
    const per = Math.ceil((total / credits) * 100) / 100;
    if (credits === 1) return per;
    if (!best || per < best) best = per;
  }
  return best;
}
