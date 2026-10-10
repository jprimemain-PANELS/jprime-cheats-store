import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const SESSION_COOKIE_NAME = "jprime_session";
export const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
export const SESSION_ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;

export type SessionPayload = {
  username: string;
  issuedAt: number;
  lastActivityAt: number;
};

export type AuthenticatedUser = {
  username: string;
  email: string | null;
  role: string | null;
  mobile_number?: string | null;
};

function getSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

export function isSessionConfigured(): boolean {
  return getSecret() !== null;
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createSessionToken(payload: SessionPayload): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function readSession(request: NextRequest): SessionPayload | null {
  const secret = getSecret();
  if (!secret) return null;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, suppliedSignature] = parts;
  const expectedSignature = sign(encoded, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    const now = Date.now();
    if (
      typeof payload.username !== "string" || !payload.username.trim() ||
      !Number.isFinite(payload.issuedAt) || !Number.isFinite(payload.lastActivityAt) ||
      payload.issuedAt > now + 60_000 || payload.lastActivityAt > now + 60_000 ||
      now - payload.lastActivityAt >= SESSION_IDLE_TIMEOUT_MS ||
      now - payload.issuedAt >= SESSION_ABSOLUTE_TIMEOUT_MS
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_ABSOLUTE_TIMEOUT_MS / 1000),
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const session = readSession(request);
  if (!session) return null;

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("username, email, role, mobile_number")
    .eq("username", session.username)
    .maybeSingle();

  if (error || !data) return null;
  return {
    username: String(data.username),
    email: data.email == null ? null : String(data.email),
    role: data.role == null ? null : String(data.role),
    mobile_number: data.mobile_number == null ? null : String(data.mobile_number),
  };
}
