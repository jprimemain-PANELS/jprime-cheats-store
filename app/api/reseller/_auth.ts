import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/auth";
import { canTransact, currentTenant, type Tenant } from "@/lib/tenant";
import { resellerFromKey } from "@/lib/reseller-api";

export const NO_STORE = { "Cache-Control": "no-store" };

/** The key can arrive the way different bots send it: Bearer, X-API-Token, X-API-Key, ?api_key=, or a form / JSON field. */
export function keyFrom(request: NextRequest, body?: Record<string, unknown>): string {
  const h = request.headers;
  const bearer = (h.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return String(bearer || h.get("x-api-token") || h.get("x-api-key") || request.nextUrl.searchParams.get("api_key") || body?.api_key || body?.token || "").trim();
}

/** Reads a JSON or form-encoded body into a plain object (never throws). */
export async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  if (request.method === "GET" || request.method === "HEAD") return {};
  const ct = request.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) { const j = await request.json(); return j && typeof j === "object" ? (j as Record<string, unknown>) : {}; }
    const text = await request.text();
    if (ct.includes("application/x-www-form-urlencoded") || (text && !text.trim().startsWith("{"))) return Object.fromEntries(new URLSearchParams(text));
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch { return {}; }
}

export type Authed = { ok: true; tenant: Tenant; username: string } | { ok: false; status: number; error: string };

export async function authenticate(request: NextRequest, body?: Record<string, unknown>): Promise<Authed> {
  const tenant = await currentTenant();
  if (!tenant) return { ok: false, status: 404, error: "Store not found." };
  const raw = keyFrom(request, body);
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "ip";
  if (!rateLimit(`rapi-ip:${tenant.id}:${ip}`, 240, 60_000)) return { ok: false, status: 429, error: "Too many requests." };
  const who = await resellerFromKey(tenant.id, raw);
  if (!who) return { ok: false, status: 401, error: "Invalid API key." };
  if (!canTransact(tenant)) return { ok: false, status: 403, error: "This store is not active." };
  if (!rateLimit(`rapi:${tenant.id}:${who.username}`, 120, 60_000)) return { ok: false, status: 429, error: "Too many requests (max 120 per minute)." };
  return { ok: true, tenant, username: who.username };
}

export const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });
