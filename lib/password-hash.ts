import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PREFIX = "scrypt";
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const derived = scryptSync(password, salt, KEY_LENGTH).toString("base64url");
  return `${PREFIX}$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): { valid: boolean; needsUpgrade: boolean } {
  if (!stored.startsWith(`${PREFIX}$`)) {
    // Legacy accounts have plaintext values. Verify only on the server and migrate on successful login.
    return { valid: stored === password, needsUpgrade: stored === password };
  }

  const [, salt, encodedKey] = stored.split("$");
  if (!salt || !encodedKey) return { valid: false, needsUpgrade: false };
  try {
    const expected = Buffer.from(encodedKey, "base64url");
    if (expected.length !== KEY_LENGTH) return { valid: false, needsUpgrade: false };
    const actual = scryptSync(password, salt, expected.length);
    return { valid: timingSafeEqual(actual, expected), needsUpgrade: false };
  } catch {
    return { valid: false, needsUpgrade: false };
  }
}
