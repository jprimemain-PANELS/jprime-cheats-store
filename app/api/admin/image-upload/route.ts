import { NextRequest, NextResponse } from "next/server";
import { rateLimit, requireTenantAdmin } from "@/lib/auth";
import { MAX_IMAGE_BYTES, buildVideoKey, imageExtFor, presignPut, r2Config } from "@/lib/r2-upload";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/** Tells the branding page whether gallery upload for pictures is switched on (same R2 setup as videos). */
export async function GET(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ success: true, enabled: !!r2Config(), maxMb: MAX_IMAGE_BYTES / 1024 / 1024 }, { headers: NO_STORE });
}

/** Admin / co-admin of THIS store asks for a one-time picture upload link. The file goes browser -> R2 (never through Vercel/Supabase). */
export async function POST(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (!auth.ok) return auth.response;
  if (!rateLimit(`image-upload:${auth.user.username}:${auth.tenant.id}`, 30, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many uploads. Wait a minute." }, { status: 429, headers: NO_STORE });
  }
  const cfg = r2Config();
  if (!cfg) return NextResponse.json({ success: false, error: "Picture upload is not set up yet. You can still paste an image link." }, { status: 503, headers: NO_STORE });
  const b = await request.json().catch(() => ({}));
  const contentType = String(b.contentType || "").toLowerCase();
  const size = Number(b.size);
  const ext = imageExtFor(contentType);
  if (!ext) return NextResponse.json({ success: false, error: "Only PNG, JPG, WebP or GIF pictures are allowed." }, { status: 400, headers: NO_STORE });
  if (!Number.isFinite(size) || size <= 0 || size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ success: false, error: `Picture must be under ${MAX_IMAGE_BYTES / 1024 / 1024} MB.` }, { status: 400, headers: NO_STORE });
  }
  const key = buildVideoKey(auth.tenant.id, ext, "images");
  const { uploadUrl, publicUrl } = presignPut(cfg, key, contentType);
  return NextResponse.json({ success: true, uploadUrl, publicUrl, contentType }, { headers: NO_STORE });
}
