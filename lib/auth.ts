import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { tdb } from "@/lib/tenant-db";
import { currentTenant, OWNER_TENANT_ID, type Tenant } from "@/lib/tenant";

/**
 * Server-verified sessions.
 *
 * - The browser only ever holds an opaque, HMAC-signed, HttpOnly cookie.
 * - The username inside the cookie is trusted ONLY because the signature is
 *   valid. The user's role is re-read from the database on every request, so
 *   a demoted admin loses access immediately.
 * - No new table is needed (stateless session). Env var: SESSION_SECRET.
 */

export const SESSION_COOKIE = "jp_session";
const SESSION_TTL_SECONDS = 15 * 60; // 15 minutes; refreshed by the activity heartbeat

function normHost(hostHeader?: string | null): string {
  return String(hostHeader || "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

/**
 * Share the OWNER store's session between jprimecheats.store and www.jprimecheats.store ONLY.
 * Any other subdomain (e.g. a co-admin store) gets a host-only cookie: never a shared one.
 */
function sessionCookieDomain(hostHeader?: string | null): string | undefined {
  const host = normHost(hostHeader);
  return host === "jprimecheats.store" || host === "www.jprimecheats.store" ? ".jprimecheats.store" : undefined;
}

/**
 * A store hosted UNDER jprimecheats.store (e.g. andrews.jprimecheats.store) would otherwise receive
 * the owner's shared cookie too. Give such hosts their own cookie name so the two can never clash.
 * Every other host keeps the original name (host-only cookies cannot reach sibling hosts).
 */
export function sessionCookieName(hostHeader?: string | null): string {
  const host = normHost(hostHeader);
  if (host.endsWith(".jprimecheats.store") && host !== "www.jprimecheats.store") {
    return `jp_s_${crypto.createHash("sha256").update(host).digest("hex").slice(0, 12)}`;
  }
  return SESSION_COOKIE;
}

export type SessionUser = {
  tenantId: string;
  id: string | number | null;
  username: string;
  email: string | null;
  role: string;
};

/** Normalize role casing/whitespace for consistent authorization checks. */
export function normalizeRole(role: unknown): string {
  return String(role ?? "user").trim().toLowerCase();
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET is not configured (min 32 chars).");
  }
  return secret;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function hmac(data: string): string {
  return b64url(crypto.createHmac("sha256", getSecret()).update(data).digest());
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** Short fingerprint of the stored password, so a password change revokes old sessions. */
function passwordFingerprint(storedPassword: string): string {
  return hmac(`pf:${storedPassword}`).slice(0, 16);
}

/* ------------------------------------------------------------------ */
/* passwords (scrypt, with lazy migration from legacy plaintext)       */
/* ------------------------------------------------------------------ */

const SCRYPT_PREFIX = "scrypt$";

export function isHashedPassword(stored: string): boolean {
  return typeof stored === "string" && stored.startsWith(SCRYPT_PREFIX);
}

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${SCRYPT_PREFIX}${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (typeof plain !== "string" || typeof stored !== "string" || !stored) {
    return false;
  }

  if (isHashedPassword(stored)) {
    const parts = stored.split("$");
    if (parts.length !== 3) return false;
    try {
      const salt = Buffer.from(parts[1], "hex");
      const expected = Buffer.from(parts[2], "hex");
      const actual = crypto.scryptSync(plain, salt, expected.length, {
        N: 16384,
        r: 8,
        p: 1,
      });
      return crypto.timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  // Legacy plaintext password (existing accounts). Constant-time compare.
  return safeEqual(plain, stored);
}

/* ------------------------------------------------------------------ */
/* session tokens                                                      */
/* ------------------------------------------------------------------ */

type TokenPayload = { i?: string; u: string; pf: string; exp: number; t?: string };

export function createSessionToken(
  username: string,
  storedPassword: string,
  userId: string | number,
  tenantId: string = OWNER_TENANT_ID
): string {
  const payload: TokenPayload = {
    t: tenantId,
    i: String(userId),
    u: username,
    pf: passwordFingerprint(storedPassword),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${hmac(body)}`;
}

function parseToken(token: string): TokenPayload | null {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  if (!safeEqual(sig, hmac(body))) return null;

  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as TokenPayload;
    if (
      !payload ||
      typeof payload.u !== "string" ||
      typeof payload.pf !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function attachSessionCookie(
  response: NextResponse,
  username: string,
  storedPassword: string,
  userId: string | number,
  hostHeader?: string | null,
  tenantId: string = OWNER_TENANT_ID
): NextResponse {
  const domain = sessionCookieDomain(hostHeader);
  const secure = process.env.NODE_ENV === "production";
  const token = createSessionToken(username, storedPassword, userId, tenantId);

  response.cookies.set(sessionCookieName(hostHeader), token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    ...(domain ? { domain } : {}),
  });

  // Expire any legacy host-only cookie on the current host. The shared cookie
  // above then works across both apex and www versions of the site.
  if (domain) {
    response.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`
    );
  }
  return response;
}

export function clearSessionCookie(
  response: NextResponse,
  hostHeader?: string | null
): NextResponse {
  const domain = sessionCookieDomain(hostHeader);
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(sessionCookieName(hostHeader), "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    ...(domain ? { domain } : {}),
  });

  // Clear older host-only cookies too, so logout works after the domain change.
  if (domain) {
    response.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`
    );
  }
  return response;
}

/* ------------------------------------------------------------------ */
/* current user                                                        */
/* ------------------------------------------------------------------ */

export async function getSessionUser(): Promise<SessionUser | null> {
  let token: string | undefined;
  try {
    let h = "";
    try { const hh = await headers(); h = hh.get("host") || hh.get("x-forwarded-host") || ""; } catch { /* no request context */ }
    token = (await cookies()).get(sessionCookieName(h))?.value;
  } catch {
    return null;
  }
  if (!token) return null;

  let payload: TokenPayload | null;
  try {
    payload = parseToken(token);
  } catch {
    return null; // SESSION_SECRET missing -> nobody is authenticated
  }
  if (!payload) return null;

  // The session is valid ONLY on the store it was issued for. The tenant comes from the
  // trusted Host mapping, never from the client. Sessions issued before multi-tenancy
  // have no "t" claim and belong to the owner store.
  const tenant = await currentTenant();
  if (!tenant) return null;
  const tokenTenant = payload.t ?? OWNER_TENANT_ID;
  if (tokenTenant !== tenant.id) return null;

  const db = tdb(tenant.id);

  // New sessions contain the immutable users.id so duplicate usernames cannot
  // make a valid account ambiguous. Legacy sessions are accepted only when the
  // username resolves to exactly one user in THIS tenant; otherwise log in again.
  let row: any = null;
  if (payload.i) {
    const { data, error } = await db.from("users").select("*").eq("id", payload.i).maybeSingle();
    if (error || !data) return null;
    row = data;
    if (String(row.username ?? "") !== payload.u) return null;
  } else {
    const { data, error } = await db.from("users").select("*").eq("username", payload.u).limit(2);
    if (error || !data || data.length !== 1) return null;
    row = data[0];
  }
  if (String(row.tenant_id ?? OWNER_TENANT_ID) !== tenant.id) return null; // belt and braces
  if (!safeEqual(passwordFingerprint(String(row.password ?? "")), payload.pf)) {
    return null;
  }

  return {
    tenantId: tenant.id,
    id: row.id == null ? null : String(row.id),
    username: String(row.username),
    email: row.email ? String(row.email) : null,
    role: String(row.role || "user"),
  };
}

/* ------------------------------------------------------------------ */
/* guards                                                              */
/* ------------------------------------------------------------------ */

function deny(status: number, error: string) {
  return NextResponse.json(
    { success: false, error },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

/** CSRF defence in depth: state-changing requests must come from our own origin. */
export function isSameOrigin(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;

  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export type AuthOk = { ok: true; user: SessionUser; tenant: Tenant };
export type AuthResult = AuthOk | { ok: false; response: NextResponse };

export async function requireUser(request: NextRequest): Promise<AuthResult> {
  if (!isSameOrigin(request)) {
    return { ok: false, response: deny(403, "Cross-origin request blocked.") };
  }

  const user = await getSessionUser();
  const tenant = user ? await currentTenant() : null;
  if (!user || !tenant || tenant.id !== user.tenantId) {
    return { ok: false, response: deny(401, "Please log in.") };
  }
  return { ok: true, user, tenant };
}

/** True only for the platform owner: role "admin" inside the OWNER tenant. */
export function isOwnerAdmin(user: SessionUser, tenant: Tenant): boolean {
  return user.role === "admin" && tenant.kind === "owner" && tenant.id === OWNER_TENANT_ID && user.tenantId === tenant.id;
}

/** Platform-level admin (cross-tenant dashboard). A co-admin can never pass this. */
export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth;
  if (!isOwnerAdmin(auth.user, auth.tenant)) {
    return { ok: false, response: deny(403, "Unauthorized") };
  }
  return auth;
}

/**
 * Admin of the CURRENT store: the platform owner on the owner store, or a co-admin on
 * their own store. All data access afterwards is scoped to auth.tenant.id.
 */
export async function requireTenantAdmin(request: NextRequest): Promise<AuthResult> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth;
  const { user, tenant } = auth;
  const ownerOk = isOwnerAdmin(user, tenant);
  const coadminOk = user.role === "coadmin" && tenant.kind === "coadmin" && user.tenantId === tenant.id;
  if (!ownerOk && !coadminOk) {
    return { ok: false, response: deny(403, "Unauthorized") };
  }
  return auth;
}

/* ------------------------------------------------------------------ */
/* best-effort rate limiter (per server instance)                      */
/* ------------------------------------------------------------------ */

const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    }
    return true;
  }

  b.count += 1;
  return b.count <= limit;
}

export function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : request.headers.get("x-real-ip")) || "unknown";
}
