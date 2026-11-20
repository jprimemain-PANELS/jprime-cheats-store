import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { readSetting, writeSetting, tdb } from "@/lib/tenant-db";
import { OWNER_TENANT_ID } from "@/lib/tenant";

/**
 * GUILD PARTNERS: other people's own websites that sell Guild Glory but do NOT get your seller website or hosting.
 * A partner receives an API key for THIS website (never your seller key). Their site calls /api/partner/guild/...;
 * every group costs the partner's wallet (a normal user wallet on the main site, topped up the normal way) the owner's price
 * for one token (reseller / VIP price rules), or a fixed price you set. Keys are stored only as a SHA-256 hash and are shown once.
 */
export type Partner = { id: string; name: string; username: string; keyHash: string; keyHint: string; cost: number; active: boolean; createdAt: string };
const KEY = "guild_partners";
const MAX = 50;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

async function load(): Promise<Partner[]> {
  const { data, error } = await readSetting(OWNER_TENANT_ID, KEY);
  const list = !error && Array.isArray(data?.value) ? data.value : [];
  return list.filter((p: any) => p && typeof p.id === "string" && typeof p.keyHash === "string");
}
const save = (list: Partner[]) => writeSetting(OWNER_TENANT_ID, KEY, list);

const view = (p: Partner) => ({ id: p.id, name: p.name, username: p.username, keyHint: p.keyHint, cost: p.cost, active: p.active, createdAt: p.createdAt });
export async function listPartners() { return (await load()).map(view); }

export async function createPartner(input: any): Promise<{ ok: true; partner: ReturnType<typeof view>; key: string } | { ok: false; error: string }> {
  const name = String(input?.name ?? "").trim().slice(0, 60);
  const username = String(input?.username ?? "").trim();
  const cost = input?.cost === "" || input?.cost == null ? 0 : Number(input.cost);
  if (!name) return { ok: false, error: "Enter the partner's name." };
  if (!/^[A-Za-z0-9_.-]{3,40}$/.test(username)) return { ok: false, error: "Enter the partner's wallet username on this website." };
  if (!Number.isFinite(cost) || cost < 0 || cost > 100000) return { ok: false, error: "Price per group must be a number (or empty to use your normal reseller price)." };
  const u = await tdb(OWNER_TENANT_ID).from("users").select("username").eq("username", username).maybeSingle();
  if (u.error || !u.data) return { ok: false, error: "That username does not exist on this website. Create the account first (the partner's wallet)." };
  const list = await load();
  if (list.length >= MAX) return { ok: false, error: "Too many partners." };
  const key = `gp_${randomBytes(24).toString("hex")}`;
  const p: Partner = { id: randomBytes(6).toString("hex"), name, username, keyHash: sha(key), keyHint: `••••${key.slice(-4)}`, cost: Math.round(cost * 100) / 100, active: true, createdAt: new Date().toISOString() };
  const r = await save([...list, p]);
  return r.error ? { ok: false, error: "Could not save." } : { ok: true, partner: view(p), key };
}

export async function updatePartner(id: string, patch: { active?: boolean; cost?: number; rotate?: boolean; remove?: boolean }): Promise<{ ok: true; key?: string } | { ok: false; error: string }> {
  const list = await load();
  const p = list.find((x) => x.id === id);
  if (!p) return { ok: false, error: "Not found." };
  let key: string | undefined;
  if (patch.remove) { const r = await save(list.filter((x) => x.id !== id)); return r.error ? { ok: false, error: "Could not save." } : { ok: true }; }
  if (typeof patch.active === "boolean") p.active = patch.active;
  if (patch.cost !== undefined) { const c = Number(patch.cost); if (!Number.isFinite(c) || c < 0 || c > 100000) return { ok: false, error: "Bad price." }; p.cost = Math.round(c * 100) / 100; }
  if (patch.rotate) { key = `gp_${randomBytes(24).toString("hex")}`; p.keyHash = sha(key); p.keyHint = `••••${key.slice(-4)}`; }
  const r = await save(list);
  return r.error ? { ok: false, error: "Could not save." } : { ok: true, ...(key ? { key } : {}) };
}

/** The active partner owning this bearer key, or null. Constant-time comparison. */
export async function partnerFromKey(raw: string | null): Promise<Partner | null> {
  const k = String(raw ?? "").trim();
  if (!/^gp_[a-f0-9]{48}$/.test(k)) return null;
  const h = Buffer.from(sha(k), "hex");
  let found: Partner | null = null;
  for (const p of await load()) {
    const b = Buffer.from(p.keyHash, "hex");
    if (b.length === h.length && timingSafeEqual(b, h)) found = p;
  }
  return found && found.active ? found : null;
}
