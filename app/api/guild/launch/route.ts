import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { tdb, readSetting, writeSetting } from "@/lib/tenant-db";
import { requireUser, rateLimit } from "@/lib/auth";
import { acquire, creditWallet, debitWallet, logWalletTransaction, release } from "@/lib/wallet";
import { GROUP_CREDITS, createGuildGroup, creditsKey, isGuildId, listRegions } from "@/lib/guild-glory";
import { jprimeAccess } from "@/lib/api-system";
import { guildCostPerGroup } from "@/lib/store-guild";
import { OWNER_TENANT_ID } from "@/lib/tenant";
import { NO_STORE, fail, guildGate, withGuild, isGuildProduct } from "../_shared";

export const dynamic = "force-dynamic";

/** Start a bot group for a Guild/Clan ID. Spends guild credits first; they are returned if the seller refuses. */
export const POST = withGuild(async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { username } = auth.user;
  const tenantId = auth.tenant.id;
  const blocked = guildGate(auth.tenant, tenantId);
  if (blocked) return blocked;
  if (!rateLimit(`guild-launch:${tenantId}:${username}`, 6, 60_000)) return fail("Too many requests. Please wait a moment.", 429);
  const lockKey = `guild-launch:${tenantId}:${username}`;
  if (!acquire(lockKey)) return fail("Another launch is already in progress.", 409);
  try {
    const b = await request.json().catch(() => ({}));
    const productName = String(b?.product_name ?? "").trim();
    const region = String(b?.region ?? "").trim();
    const clanId = String(b?.guild_id ?? "").trim();
    if (!isGuildId(clanId)) return fail("Enter the correct Guild / Clan ID (numbers only).", 400);
    if (!productName || !(await isGuildProduct(tenantId, productName))) return fail("This service is not available.", 404);
    const st = await tdb(tenantId).from("product_prices").select("price_inr").eq("product_name", productName).eq("duration", "__status__").maybeSingle();
    if (Number((st.data as any)?.price_inr) === 1) return fail("This service is under maintenance. Please check back soon.", 409);

    const regions = await listRegions();
    if (!regions.ok) return fail("Regions are not available right now. Try again soon.", 502);
    const reg = regions.regions.find((r) => r.id === region);
    if (!reg) return fail("Choose an available account region.", 400);

    // A co-admin store runs on the OWNER's seller account: the store's payer wallet (main site) pays the owner's price per group, first, atomically.
    let payerPaid: { payer: string; cost: number } | null = null;
    if (tenantId !== OWNER_TENANT_ID) {
      const access = await jprimeAccess(tenantId);
      if (!access.allowed || !access.payer) return fail("This service is not available right now.", 503);
      const cost = await guildCostPerGroup(access.payer);
      if (!(cost > 0)) return fail("This service is not available right now.", 503);
      const pay = await debitWallet(OWNER_TENANT_ID, access.payer, cost);
      if (!pay.ok) return fail(pay.reason === "insufficient" ? "Out of stock. The store admin's credit is low, please contact the admin." : "This service is not available right now.", pay.reason === "insufficient" ? 409 : 503);
      await logWalletTransaction({ tenantId: OWNER_TENANT_ID, username: access.payer, type: "debit", amount: cost, balance_after: pay.balance, description: `Guild Glory group for store ${tenantId.slice(0, 8)}` });
      payerPaid = { payer: access.payer, cost };
    }
    const refundPayer = async () => {
      if (!payerPaid) return;
      const r = await creditWallet(OWNER_TENANT_ID, payerPaid.payer, payerPaid.cost);
      if (r.ok) await logWalletTransaction({ tenantId: OWNER_TENANT_ID, username: payerPaid.payer, type: "refund", amount: payerPaid.cost, balance_after: r.balance, description: "Refund: Guild Glory group failed" });
      else console.error("GUILD PAYER REFUND FAILED - MANUAL REVIEW:", { tenantId, payer: payerPaid.payer, cost: payerPaid.cost });
    };

    const spend = await debitWallet(tenantId, creditsKey(username), GROUP_CREDITS);
    if (!spend.ok) { await refundPayer(); }
    if (!spend.ok) return fail(spend.reason === "insufficient" ? "You have no guild credits. Buy a token and redeem it first." : "Could not use your credits.", spend.reason === "insufficient" ? 400 : 500);

    const idem = `jp-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`;
    let result: Awaited<ReturnType<typeof createGuildGroup>>;
    try { result = await createGuildGroup({ region: reg.id, clanId, idem }); } catch { result = { success: false, error: "Guild Glory service failed." }; }
    if (!result.success) {
      await refundPayer();
      const back = await creditWallet(tenantId, creditsKey(username), GROUP_CREDITS);
      if (!back.ok) console.error("GUILD CREDIT REFUND FAILED - MANUAL REVIEW:", { username, clanId });
      return fail(`Could not start the bot right now. Your credit was returned. (${result.error})`, 502, { credits: back.ok ? back.balance : undefined });
    }

    const rec = { ref: result.ref, clan: clanId, region: reg.id, regionName: reg.name, at: new Date().toISOString() };
    try {
      const cur = await readSetting(tenantId, `guildgroups:${username}`);
      const list = Array.isArray(cur.data?.value) ? cur.data.value : [];
      await writeSetting(tenantId, `guildgroups:${username}`, [rec, ...list].slice(0, 30));
    } catch {}
    await logWalletTransaction({ tenantId, username, type: "guild_launch", amount: 0, balance_after: spend.balance, description: `Guild group started: ${clanId} (${reg.name}) ${result.ref}` });
    return NextResponse.json({ success: true, ref: result.ref, credits: spend.balance, message: "Bot is joining your guild and will start playing." }, { headers: NO_STORE });
  } catch (e) {
    console.error("GUILD LAUNCH ERROR:", e instanceof Error ? e.message : "unknown");
    return fail("Launch failed.", 500);
  } finally {
    release(lockKey);
  }
});
