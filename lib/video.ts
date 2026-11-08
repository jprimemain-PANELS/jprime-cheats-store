/**
 * Product video source parser. Pure (no imports). Decides what the storefront may render.
 *
 *  - YouTube watch / youtu.be / Shorts / embed / live URLs -> a fixed, privacy-friendly embed URL
 *    built from the validated 11-character video id (the original URL is never put in an iframe).
 *  - Direct video files (e.g. Cloudinary MP4) -> played with <video>.
 *  - Anything else (javascript:, data:, blob:, file:, ftp: ...) -> null, nothing is rendered.
 */

export type VideoSource =
  | { kind: "youtube"; id: string; embedUrl: string }
  | { kind: "file"; src: string }
  | null;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const YOUTU_BE_HOSTS = new Set(["youtu.be", "www.youtu.be"]);

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function parseStartSeconds(value: string | null): number | null {
  if (!value) return null;
  if (/^\d{1,6}$/.test(value)) return Number(value);
  const match = /^(?:(\d{1,3})h)?(?:(\d{1,3})m)?(?:(\d{1,5})s)?$/i.exec(value);
  if (!match || (!match[1] && !match[2] && !match[3])) return null;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function buildEmbedUrl(id: string, start: number | null): string {
  const params = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1" });
  if (start && start > 0) params.set("start", String(start));
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export function parseVideoSource(input: unknown): VideoSource {
  const raw = String(input ?? "").trim();
  if (!raw || raw.length > 2048) return null;

  // Same-site relative file (e.g. /videos/demo.mp4). "//host/..." is NOT accepted.
  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")) {
    return { kind: "file", src: raw };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase();

  if (YOUTU_BE_HOSTS.has(host)) {
    const id = url.pathname.split("/").filter(Boolean)[0] || "";
    return VIDEO_ID.test(id)
      ? { kind: "youtube", id, embedUrl: buildEmbedUrl(id, parseStartSeconds(url.searchParams.get("t") || url.searchParams.get("start"))) }
      : null;
  }

  if (YOUTUBE_HOSTS.has(host)) {
    const parts = url.pathname.split("/").filter(Boolean);
    let id = "";

    if (parts[0] === "watch") id = url.searchParams.get("v") || "";
    else if (["shorts", "embed", "live", "v"].includes(parts[0] || "")) id = parts[1] || "";

    if (!VIDEO_ID.test(id)) return null;
    const start = parseStartSeconds(url.searchParams.get("t") || url.searchParams.get("start"));
    return { kind: "youtube", id, embedUrl: buildEmbedUrl(id, start) };
  }

  // Any other http(s) URL is treated as a direct video file, exactly like before.
  return { kind: "file", src: url.toString() };
}
