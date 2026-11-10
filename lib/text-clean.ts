/**
 * Product names / ids / durations are KEYS: prices, stock and orders are matched by exact text.
 * Pasting "stylish" text (𝓕𝓻𝓮𝓮 𝓕𝓲𝓻𝓮, ＦＲＥＥ, ⓕⓡⓔⓔ) or hidden characters breaks that matching.
 * NFKC turns those look-alikes into the plain letters; invisible characters are removed.
 * Pure functions (no I/O): safe on the server, in the browser and in tests.
 */
// control chars, soft hyphen, zero-width / bidi marks, word joiners, variation selectors, BOM, filler chars
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f­͏؜ᅟᅠ឴឵᠋-᠏​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ]/g;

export function cleanProductText(v: unknown, max = 80): string {
  return String(v ?? "").normalize("NFKC").replace(INVISIBLE, "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Ids are lowercase letters, numbers, dot and hyphen only. */
export function cleanProductId(v: unknown): string {
  return cleanProductText(v, 64)
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9.-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

/** True when cleaning would change the text (so the UI can tell the person). */
export const changedByCleaning = (v: unknown) => String(v ?? "").trim() !== cleanProductText(v, 10_000);
