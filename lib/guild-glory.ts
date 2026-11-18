/**
 * Guild Glory bot service. Built against the seller's FF GUILD GLORY API v1 (API_V1.md, as used by their tester):
 *   GET  {base}/api/v1/regions          -> { data: [{ id, name, code, available, maintenance }] }
 *   POST {base}/api/v1/groups           -> body { region, clan_id }, header Idempotency-Key (8-100 chars)
 *   GET  {base}/api/v1/groups           -> { data: [{ group_id, clan_id, region, status }] }
 * All calls use  Authorization: Bearer <GUILD_API_KEY>.  The key never reaches the browser.
 *
 * Env (owner store): GUILD_API_URL = the seller website, e.g. https://automission.site   GUILD_API_KEY = key from their Developer Center.
 *
 * Shop side (no SQL needed): customers buy TOKENS with their wallet, redeem a token into "guild credits", and launching
 * a group spends GROUP_CREDITS credit(s). Credits and tokens are held as hidden wallet rows, so they get the same
 * atomic debit/credit protection as money:  gg:<user> = a customer's credits,  ggt:<CODE> = an unredeemed token.
 */
import { randomBytes } from "crypto";

export const GROUP_CREDITS = 1;
export const creditsKey = (username: string) => `gg:${username}`;
export const tokenKey = (code: string) => `ggt:${code}`;

export type GuildRegion = { id: string; name: string; code: string };

export const isGuildId = (v: unknown) => /^[0-9]{5,20}$/.test(String(v ?? "").trim());
export const isTokenCode = (v: unknown) => /^GG-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(String(v ?? ""));
/** "5 credits" / "1 credit" -> 5 / 1 (0 when the plan name does not start with a number). */
export const creditsOfPlan = (duration: string) => {
  const n = Number(/^\s*(\d{1,3})\b/.exec(String(duration ?? ""))?.[1] ?? 0);
  return n >= 1 && n <= 100 ? n : 0;
};
export const makeTokenCode = () => {
  const a = randomBytes(10).toString("hex").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `GG-${a.slice(0, 4)}-${a.slice(4, 8)}-${a.slice(8, 12)}-${a.slice(12, 16) || randomBytes(2).toString("hex").toUpperCase()}`;
};

export function guildBase(): string {
  let v = (process.env.GUILD_API_URL || "").trim().replace(/\/+$/, "");
  while (v.endsWith("/api/v1")) v = v.slice(0, -7).replace(/\/+$/, "");
  return /^https:\/\/[^/\s]+/.test(v) ? v : "";
}
export function guildApiConfigured(): boolean {
  return !!guildBase() && !!process.env.GUILD_API_KEY;
}

async function call(method: "GET" | "POST" | "DELETE", path: string, body?: unknown, idem?: string): Promise<{ ok: boolean; status: number; json: any; error?: string }> {
  if (!guildApiConfigured()) return { ok: false, status: 0, json: null, error: "Guild Glory service is not connected yet." };
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${process.env.GUILD_API_KEY}`, Accept: "application/json" };
    if (method === "POST") headers["Content-Type"] = "application/json";
    if (idem) headers["Idempotency-Key"] = idem;
    const res = await fetch(guildBase() + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", redirect: "manual" });
    const text = (await res.text()).replace(/^﻿/, "").trim();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    if (res.status === 401 || res.status === 403) return { ok: false, status: res.status, json, error: "Guild Glory service key was rejected." };
    if (res.status === 429) return { ok: false, status: res.status, json, error: "Guild Glory service is busy. Try again in a minute." };
    const logical = res.ok && json && json.ok !== false && json.success !== false;
    const msg = json?.error?.message ?? (typeof json?.error === "string" ? json.error : undefined) ?? json?.message;
    return { ok: !!logical, status: res.status, json, error: logical ? undefined : String(msg ?? (json ? "Guild Glory service rejected the request." : "Guild Glory service returned invalid data.")).slice(0, 200) };
  } catch (e) {
    return { ok: false, status: 0, json: null, error: e instanceof Error ? e.message.slice(0, 120) : "Guild Glory service request failed." };
  }
}

let regionCache: { at: number; list: GuildRegion[] } | null = null;
/** Regions that are available right now (live from the seller; cached 60 s). */
export async function listRegions(): Promise<{ ok: true; regions: GuildRegion[] } | { ok: false; error: string }> {
  if (!process.env.VITEST && regionCache && Date.now() - regionCache.at < 60_000) return { ok: true, regions: regionCache.list };
  const r = await call("GET", "/api/v1/regions");
  if (!r.ok) return { ok: false, error: r.error || "Could not load regions." };
  const rows: any[] = Array.isArray(r.json?.data) ? r.json.data : [];
  const list = rows.filter((x) => x && x.available === true && !x.maintenance && x.id != null).map((x) => ({ id: String(x.id), name: String(x.name ?? x.id), code: String(x.code ?? "") }));
  regionCache = { at: Date.now(), list };
  return { ok: true, regions: list };
}

export type GuildResult = { success: true; ref: string } | { success: false; error: string };
/** Starts the bot group on the seller. `idem` must be unique per attempt (8-100 chars). */
export async function createGuildGroup(input: { region: string; clanId: string; idem: string }): Promise<GuildResult> {
  const r = await call("POST", "/api/v1/groups", { region: input.region, clan_id: input.clanId }, input.idem);
  if (!r.ok) return { success: false, error: r.error || "Guild Glory service rejected the order." };
  const d = r.json?.data ?? {};
  const id = d.group_id ?? d.request_ref ?? d.id ?? r.json?.request_ref ?? input.idem;
  return { success: true, ref: String(id).slice(0, 80) };
}

export type SellerGroup = { group_id: string; clan_id: string; region: string; status: string; created: number | null };
/** Seller's group list (all of the owner's groups); we only look up our own. */
export async function listSellerGroups(): Promise<SellerGroup[]> {
  const r = await call("GET", "/api/v1/groups");
  const rows: any[] = r.ok && Array.isArray(r.json?.data) ? r.json.data : r.ok && Array.isArray(r.json?.data?.groups) ? r.json.data.groups : [];
  return rows.map((g) => {
    const t = Date.parse(String(g.created_at ?? g.createdAt ?? g.created ?? ""));
    return { group_id: String(g.group_id ?? g.id ?? ""), clan_id: String(g.clan_id ?? g.clanId ?? ""), region: String(g.region ?? ""), status: String(g.status ?? "unknown"), created: Number.isFinite(t) ? t : null };
  });
}

/** A customer's saved group (what we store per user). `gid` = the seller's real group id once we have matched it; `name` = last known guild name. */
export type GroupRec = { ref: string; clan: string; region: string; regionName: string; at: string; gid?: string; name?: string; refunded?: boolean };
const sameRegion = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Pairs each saved group with the seller's real group, once, and remembers it (rec.gid) so it never flips back to "starting".
 * Several groups for the same Guild ID are told apart by creation time. Returns true when anything was newly paired.
 */
export function bindGroups(recs: GroupRec[], seller: SellerGroup[]): boolean {
  let changed = false;
  const used = new Set(recs.map((r) => r.gid).filter(Boolean) as string[]);
  for (const r of recs) if (!r.gid) {
    const direct = seller.find((x) => x.group_id && x.group_id === r.ref);
    if (direct) { r.gid = direct.group_id; used.add(direct.group_id); changed = true; }
  }
  const at = (r: GroupRec) => Date.parse(r.at) || 0;
  for (const sg of seller) {
    if (!sg.group_id || used.has(sg.group_id)) continue;
    const cands = recs.filter((r) => !r.gid && r.clan === sg.clan_id && (sameRegion(r.region, sg.region) || !sg.region));
    const pool = cands.length ? cands : recs.filter((r) => !r.gid && r.clan === sg.clan_id);
    if (!pool.length) continue;
    // nearest in time (a seller group is created right after we launched it); without a date, the newest unpaired one
    const best = sg.created != null ? pool.reduce((a, b) => (Math.abs(at(a) - sg.created!) <= Math.abs(at(b) - sg.created!) ? a : b)) : pool.reduce((a, b) => (at(a) >= at(b) ? a : b));
    if (sg.created != null && Math.abs(at(best) - sg.created) > 30 * 60_000) continue;
    best.gid = sg.group_id; used.add(sg.group_id); changed = true;
  }
  return changed;
}

/* ---------- live group panel (details / clan / glory / restart / stop) ---------- */
const SAFE_ID = /^[A-Za-z0-9._-]{1,80}$/;
export const isSafeGroupId = (v: unknown) => SAFE_ID.test(String(v ?? ""));

/** Finds the first value stored under any of `keys` (case-insensitive) in nested JSON, up to 4 levels deep. */
export function deepPick(obj: any, keys: string[], depth = 0): any {
  if (obj == null || typeof obj !== "object" || depth > 4) return undefined;
  const want = keys.map((k) => k.toLowerCase());
  if (!Array.isArray(obj)) for (const k of Object.keys(obj)) if (want.includes(k.toLowerCase()) && obj[k] != null && obj[k] !== "") return obj[k];
  for (const v of Object.values(obj)) { const r = deepPick(v, keys, depth + 1); if (r !== undefined) return r; }
  return undefined;
}
const num = (v: any): number | null => { if (Array.isArray(v)) return v.length; const n = Number(typeof v === "string" ? v.replace(/[, ]/g, "") : v); return Number.isFinite(n) ? n : null; };
const txt = (v: any, max = 60): string | null => (v == null || typeof v === "object" ? null : String(v).slice(0, max) || null);

export type GroupView = {
  groupId: string; name: string | null; level: number | null; clanId: string | null; region: string | null; status: string | null;
  members: number | null; maxMembers: number | null; captain: string | null; totalGlory: number | null; groupGlory: number | null;
  bots: number | null; uptime: string | null; goalPercent: number | null; lastMatch: string | null; weeklyGlory: number | null;
};
const fmtUptime = (v: any): string | null => {
  if (v == null || typeof v === "object") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return txt(v, 20);
  const s = Math.max(0, Math.round(n)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};

/** Last resort: a plain "name" from the group reply, unless it looks like an internal label / id. */
function genericName(part: any, groupId: string) {
  const n = deepPick(part, ["name"]);
  return typeof n === "string" && n !== groupId && !/^jp-|^[0-9a-f-]{16,}$/i.test(n) ? n : undefined;
}
/** Turns the seller's group / clan / glory replies into one small, safe object. Unknown fields stay null (the UI hides them). */
export function normalizeGroup(groupId: string, parts: any[]): GroupView {
  // keys are tried in priority order across all replies (so a generic "name" in the group reply never beats "clan_name" in the clan reply)
  const pick = (keys: string[]) => { for (const k of keys) for (const p of parts) { const r = deepPick(p, [k]); if (r !== undefined) return r; } return undefined; };
  let members = pick(["members", "member_count", "members_count", "current_members"]);
  let maxMembers = pick(["max_members", "member_limit", "members_max", "capacity", "max_capacity"]);
  if (typeof members === "string" && members.includes("/")) { const [a, b] = members.split("/"); members = a; if (maxMembers == null) maxMembers = b; }
  if (members && typeof members === "object" && !Array.isArray(members)) members = deepPick(members, ["count", "current", "total"]);
  const goal = num(pick(["goal_percent", "goal_progress", "eight_hour_goal", "goal_8h", "goal"]));
  return {
    groupId,
    name: txt(pick(["clan_name", "guild_name", "clanName", "guildName"]) ?? deepPick(parts[1], ["name"]) ?? genericName(parts[0], groupId)),
    level: num(pick(["level", "clan_level", "guild_level"])),
    clanId: txt(pick(["clan_id", "guild_id"]), 24),
    region: txt(pick(["region", "region_code"]), 12),
    status: txt(pick(["status", "state"]), 24),
    members: num(members), maxMembers: num(maxMembers),
    captain: txt(pick(["captain", "captain_id", "captain_uid", "leader", "leader_id"]), 24),
    totalGlory: num(pick(["total_glory", "clan_glory", "glory_total", "glory_points"])),
    groupGlory: num(pick(["group_glory", "gained_glory", "glory_gained", "glory"])),
    bots: num(pick(["bots", "bot_count", "bots_count", "players", "player_count"])),
    uptime: fmtUptime(pick(["uptime", "uptime_seconds", "uptime_text"])),
    goalPercent: goal == null ? null : Math.max(0, Math.min(100, goal)),
    lastMatch: txt(pick(["last_match", "last_match_at", "lastMatchAt", "last_match_time"]), 40),
    weeklyGlory: num(pick(["weekly_glory", "week_glory", "glory_weekly"])),
  };
}

const detailCache = new Map<string, { at: number; view: GroupView; raw: any[] }>();
/** Live info for one group (cached 15 s so many customers cannot exhaust the seller's 60 requests / minute). */
export async function getGroupInfo(groupId: string, force = false): Promise<{ ok: true; view: GroupView; raw: any[] } | { ok: false; error: string }> {
  if (!isSafeGroupId(groupId)) return { ok: false, error: "Invalid group." };
  const hit = detailCache.get(groupId);
  if (!force && !process.env.VITEST && hit && Date.now() - hit.at < 15_000) return { ok: true, view: hit.view, raw: hit.raw };
  const id = encodeURIComponent(groupId);
  const [d, c, g] = await Promise.all([call("GET", `/api/v1/groups/${id}`), call("GET", `/api/v1/groups/${id}/clan`), call("GET", `/api/v1/groups/${id}/glory`)]);
  if (!d.ok) return { ok: false, error: d.error || "Could not load the group." };
  const raw = [d.json, c.ok ? c.json : null, g.ok ? g.json : null]; // position matters: [group, clan, glory]
  const view = normalizeGroup(groupId, raw);
  if (detailCache.size > 500) detailCache.clear();
  detailCache.set(groupId, { at: Date.now(), view, raw });
  return { ok: true, view, raw };
}

export async function groupAction(groupId: string, action: "restart" | "stop" | "refresh-all"): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSafeGroupId(groupId)) return { ok: false, error: "Invalid group." };
  const r = await call("POST", `/api/v1/groups/${encodeURIComponent(groupId)}/actions`, { action });
  detailCache.delete(groupId);
  return r.ok ? { ok: true } : { ok: false, error: r.error || "The action failed." };
}

/** Confirmed stop, then the seller hides it from the owner's list (their DELETE does not call the supplier). */
export async function deleteGroup(groupId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSafeGroupId(groupId)) return { ok: false, error: "Invalid group." };
  const r = await call("DELETE", `/api/v1/groups/${encodeURIComponent(groupId)}`);
  detailCache.delete(groupId);
  return r.ok ? { ok: true } : { ok: false, error: r.error || "Could not delete the group." };
}

export type Row = Record<string, string | number | boolean>;
const keyOk = (k: string) => /^[A-Za-z0-9_ .-]{1,32}$/.test(k) && !/key|secret|token|password|auth/i.test(k);
/** Match history / players: whatever the seller sends, reduced to short rows of plain values (max 40 rows x 8 fields). */
export function flattenRows(json: any): Row[] {
  const data = json?.data;
  const arr: any[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.players) ? data.players : Array.isArray(data?.matches) ? data.matches : Array.isArray(data?.history) ? data.history : [];
  return arr.slice(0, 40).map((it) => {
    const out: Row = {};
    if (it && typeof it === "object") for (const [k, v] of Object.entries(it)) {
      if (Object.keys(out).length >= 8) break;
      if (keyOk(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean") && String(v) !== "") out[k] = typeof v === "string" ? v.slice(0, 60) : v;
    } else if (typeof it === "string" || typeof it === "number") out.value = String(it).slice(0, 60);
    return out;
  }).filter((r) => Object.keys(r).length > 0);
}
export async function getGroupList(groupId: string, kind: "history" | "players"): Promise<{ ok: true; rows: Row[] } | { ok: false; error: string }> {
  if (!isSafeGroupId(groupId)) return { ok: false, error: "Invalid group." };
  const r = await call("GET", `/api/v1/groups/${encodeURIComponent(groupId)}/${kind}`);
  return r.ok ? { ok: true, rows: flattenRows(r.json) } : { ok: false, error: r.error || "Could not load." };
}
