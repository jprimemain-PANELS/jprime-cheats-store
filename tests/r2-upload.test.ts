import { describe, expect, it, afterEach } from "vitest";
import { buildVideoKey, presignPut, r2Config, videoExtFor, MAX_VIDEO_BYTES } from "@/lib/r2-upload";

const cfg = { accountId: "acc", accessKeyId: "AKID", secret: "SECRET", bucket: "vids", publicUrl: "https://cdn.example.com" };

describe("r2 video upload", () => {
  afterEach(() => { for (const k of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"]) delete process.env[k]; });

  it("is disabled until every env var is set (https public url)", () => {
    expect(r2Config()).toBeNull();
    Object.assign(process.env, { R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c", R2_BUCKET: "d", R2_PUBLIC_URL: "http://insecure" });
    expect(r2Config()).toBeNull();
    process.env.R2_PUBLIC_URL = "https://cdn.example.com/";
    expect(r2Config()?.publicUrl).toBe("https://cdn.example.com");
  });

  it("only allows video types", () => {
    expect(videoExtFor("video/mp4")).toBe("mp4");
    expect(videoExtFor("VIDEO/QUICKTIME")).toBe("mov");
    expect(videoExtFor("text/html")).toBeNull();
    expect(videoExtFor("image/svg+xml")).toBeNull();
    expect(MAX_VIDEO_BYTES).toBe(200 * 1024 * 1024);
  });

  it("keys stay inside the tenant folder", () => {
    const k = buildVideoKey("../../evil/../x", "mp4");
    expect(k.startsWith("videos/")).toBe(true);
    expect(k).not.toContain("..");
    expect(k.split("/").length).toBe(3);
  });

  it("presigned url signs content-type + host, is deterministic and expires in 15 min", () => {
    const now = new Date("2026-01-02T03:04:05.000Z");
    const a = presignPut(cfg, "videos/t1/x.mp4", "video/mp4", now);
    const b = presignPut(cfg, "videos/t1/x.mp4", "video/mp4", now);
    expect(a.uploadUrl).toBe(b.uploadUrl);
    const u = new URL(a.uploadUrl);
    expect(u.host).toBe("acc.r2.cloudflarestorage.com");
    expect(u.pathname).toBe("/vids/videos/t1/x.mp4");
    expect(u.searchParams.get("X-Amz-Date")).toBe("20260102T030405Z");
    expect(u.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(u.searchParams.get("X-Amz-SignedHeaders")).toBe("content-type;host");
    expect(u.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(a.publicUrl).toBe("https://cdn.example.com/videos/t1/x.mp4");
    // a different content type must produce a different signature
    expect(presignPut(cfg, "videos/t1/x.mp4", "text/html", now).uploadUrl).not.toBe(a.uploadUrl);
    expect(a.uploadUrl).not.toContain("SECRET");
  });
});
