import { NextRequest, NextResponse } from "next/server";
import { rateLimit, requireTenantAdmin } from "@/lib/auth";
import { MAX_VIDEO_BYTES, buildVideoKey, presignPut, r2Config, videoExtFor } from "@/lib/r2-upload";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/** Tells the product form whether gallery upload is switched on (R2 env present). */
export async function GET(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ success: true, enabled: !!r2Config(), maxMb: MAX_VIDEO_BYTES / 1024 / 1024 }, { headers: NO_STORE });
}

/** Admin / co-admin of THIS store asks for a one-time upload link. The file itself goes browser -> R2. */
export async function POST(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  if (!rateLimit(`video-upload:${auth.user.username}:${auth.tenant.id}`, 15, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many uploads. Wait a minute." }, { status: 429, headers: NO_STORE });
  }
  const cfg = r2Config();
  if (!cfg) {
    return NextResponse.json({ success: false, error: "Video upload is not set up yet. You can still paste a YouTube or video link." }, { status: 503, headers: NO_STORE });
  }
  const b = await request.json().catch(() => ({}));
  const contentType = String(b.contentType || "").toLowerCase();
  const size = Number(b.size);
  const ext = videoExtFor(contentType);
  if (!ext) return NextResponse.json({ success: false, error: "Only MP4, WebM, MOV, MKV or AVI videos are allowed." }, { status: 400, headers: NO_STORE });
  if (!Number.isFinite(size) || size <= 0 || size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ success: false, error: `Video must be under ${MAX_VIDEO_BYTES / 1024 / 1024} MB.` }, { status: 400, headers: NO_STORE });
  }
  const key = buildVideoKey(auth.tenant.id, ext);
  const { uploadUrl, publicUrl } = presignPut(cfg, key, contentType);
  return NextResponse.json({ success: true, uploadUrl, publicUrl, contentType }, { headers: NO_STORE });
}
