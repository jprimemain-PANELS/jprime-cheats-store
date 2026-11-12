import { createHash, createHmac, randomBytes } from "crypto";

/**
 * Direct-to-Cloudflare-R2 video uploads (S3 compatible, SigV4 presigned PUT).
 * The browser uploads the file straight to R2, so the video never goes through Supabase storage or Vercel.
 * Only the public link is saved in the database (product.videoUrl).
 *
 * Env (all required to enable the feature): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
 */

export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

const TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "video/x-msvideo": "avi",
};

export function videoExtFor(contentType: string): string | null {
  return TYPES[String(contentType || "").toLowerCase()] || null;
}

export function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID || "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
  const secret = process.env.R2_SECRET_ACCESS_KEY || "";
  const bucket = process.env.R2_BUCKET || "";
  const publicUrl = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
  if (!accountId || !accessKeyId || !secret || !bucket || !/^https:\/\//.test(publicUrl)) return null;
  return { accountId, accessKeyId, secret, bucket, publicUrl };
}

const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data).digest();
const hex = (s: string) => createHash("sha256").update(s).digest("hex");
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

/** Builds an object key that cannot collide and cannot escape the tenant folder. */
export function buildVideoKey(tenantId: string, ext: string): string {
  const safeTenant = String(tenantId).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64) || "store";
  return `videos/${safeTenant}/${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
}

/** Presigned PUT URL (valid 15 minutes). Content-Type is part of the signature, so only that type can be uploaded. */
export function presignPut(cfg: NonNullable<ReturnType<typeof r2Config>>, key: string, contentType: string, now = new Date()) {
  const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
  const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // 20260101T000000Z
  const date = amz.slice(0, 8);
  const scope = `${date}/auto/s3/aws4_request`;
  const path = `/${cfg.bucket}/${key.split("/").map(enc).join("/")}`;
  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${cfg.accessKeyId}/${scope}`,
    "X-Amz-Date": amz,
    "X-Amz-Expires": "900",
    "X-Amz-SignedHeaders": "content-type;host",
  };
  const query = Object.keys(params).sort().map((k) => `${enc(k)}=${enc(params[k])}`).join("&");
  const canonical = ["PUT", path, query, `content-type:${contentType}\nhost:${host}\n`, "content-type;host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amz, scope, hex(canonical)].join("\n");
  const kDate = hmac("AWS4" + cfg.secret, date);
  const signature = createHmac("sha256", hmac(hmac(hmac(kDate, "auto"), "s3"), "aws4_request")).update(toSign).digest("hex");
  return {
    uploadUrl: `https://${host}${path}?${query}&X-Amz-Signature=${signature}`,
    publicUrl: `${cfg.publicUrl}/${key}`,
  };
}
