import { readSetting, writeSetting } from "@/lib/tenant-db";
import { OWNER_TENANT_ID } from "@/lib/tenant";
import { guildBase, ownerGuildCreds, type GuildCreds } from "@/lib/guild-glory";

/**
 * Guild Glory connection of a CO-ADMIN store: its own seller API key (from the seller's Developer Center), saved under
 * that store's own prefixed settings key. The key never goes back to the browser (only the last 4 characters) and is never
 * logged. The owner store keeps using the GUILD_API_KEY environment variable. The seller website address is shared (GUILD_API_URL).
 */
const KEY = "guild_api";
const KEY_OK = /^[A-Za-z0-9._~+\/=-]{16,200}$/;

async function loadKey(tenantId: string): Promise<string> {
  const { data, error } = await readSetting(tenantId, KEY);
  const v = !error && data?.value && typeof data.value === "object" ? String((data.value as any).key ?? "") : "";
  return KEY_OK.test(v) ? v : "";
}

/** Credentials for one store (null = not connected). */
export async function loadGuildCreds(tenantId: string): Promise<GuildCreds> {
  if (tenantId === OWNER_TENANT_ID) return ownerGuildCreds();
  const base = guildBase(), key = await loadKey(tenantId);
  return base && key ? { base, key } : null;
}

export async function getGuildKeyView(tenantId: string) {
  const owner = tenantId === OWNER_TENANT_ID;
  const key = owner ? process.env.GUILD_API_KEY || "" : await loadKey(tenantId);
  return { owner, serviceReady: !!guildBase(), hasKey: !!key, keyHint: key ? `••••${key.slice(-4)}` : "" };
}

export async function saveGuildKey(tenantId: string, input: any): Promise<{ ok: true } | { ok: false; error: string }> {
  if (tenantId === OWNER_TENANT_ID) return { ok: false, error: "The main store uses the server setting GUILD_API_KEY." };
  if (input?.clear === true) {
    const { error } = await writeSetting(tenantId, KEY, {});
    return error ? { ok: false, error: "Could not save." } : { ok: true };
  }
  const k = String(input?.key ?? "").trim();
  if (!KEY_OK.test(k)) return { ok: false, error: "That key does not look right. Copy it from your Guild Glory seller's Developer Center." };
  const { error } = await writeSetting(tenantId, KEY, { key: k });
  return error ? { ok: false, error: "Could not save." } : { ok: true };
}
