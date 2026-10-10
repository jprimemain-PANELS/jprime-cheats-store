import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

export type SessionUser = {
  id: string | number | null;
  username: string;
  email: string | null;
  role: string;
};

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

type TokenPayload = { u: string; pf: string; exp: number };

export function createSessionToken(username: string, storedPassword: string): string {
  const payload: TokenPayload = {
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
  storedPassword: string
): NextResponse {
  response.cookies.set(SESSION_COOKIE, createSessionToken(username, storedPassword), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

/* ------------------------------------------------------------------ */
/* current user                                                        */
/* ------------------------------------------------------------------ */

export async function getSessionUser(): Promise<SessionUser | null> {
  let token: string | undefined;
  try {
    token = (await cookies()).get(SESSION_COOKIE)?.value;
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

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("username", payload.u)
    .limit(2);

  if (error || !data || data.length !== 1) return null;

  const row: any = data[0];
  if (!safeEqual(passwordFingerprint(String(row.password ?? "")), payload.pf)) {
    return null;
  }

  return {
    id: row.id ?? null,
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

export async function requireUser(
  request: NextRequest
): Promise<{ ok: true; user: SessionUser } | { ok: false; response: NextResponse }> {
  if (!isSameOrigin(request)) {
    return { ok: false, response: deny(403, "Cross-origin request blocked.") };
  }

  const user = await getSessionUser();
  if (!user) {
    return { ok: false, response: deny(401, "Please log in.") };
  }
  return { ok: true, user };
}

export async function requireAdmin(
  request: NextRequest
): Promise<{ ok: true; user: SessionUser } | { ok: false; response: NextResponse }> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth;

  if (auth.user.role !== "admin") {
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
