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

async function call(method: "GET" | "POST", path: string, body?: unknown, idem?: string): Promise<{ ok: boolean; status: number; json: any; error?: string }> {
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

/** Seller's group list (all of the owner's groups); we only look up our own by id / clan id. */
export async function listSellerGroups(): Promise<{ group_id: string; clan_id: string; region: string; status: string }[]> {
  const r = await call("GET", "/api/v1/groups");
  const rows: any[] = r.ok && Array.isArray(r.json?.data) ? r.json.data : [];
  return rows.map((g) => ({ group_id: String(g.group_id ?? ""), clan_id: String(g.clan_id ?? ""), region: String(g.region ?? ""), status: String(g.status ?? "unknown") }));
}
