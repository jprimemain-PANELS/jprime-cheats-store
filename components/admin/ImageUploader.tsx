"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2, Trash2, UploadCloud } from "lucide-react";

const MAX_SIDE = 1600;

/** Shrinks big phone photos before upload (keeps PNG transparency). GIF is sent as is. */
async function shrink(file: File): Promise<File> {
  if (file.type === "image/gif" || !/^image\/(png|jpeg|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1_500_000) { bmp.close?.(); return file; }
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, type, 0.86));
    if (blob && blob.size < file.size) return new File([blob], file.name, { type });
  } catch { /* keep original */ }
  return file;
}

/**
 * Picture field: upload from the phone gallery (goes straight to Cloudflare R2, only the link is saved)
 * OR paste an https link. Works for logo, banner, background and login pictures.
 */
export default function ImageUploader({ label, value, onChange, hint }: { label: string; value: string; onChange: (url: string) => void; hint?: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [maxMb, setMaxMb] = useState(5);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/image-upload", { cache: "no-store" }).then((r) => r.json())
      .then((d) => { if (live) { setEnabled(!!d.enabled); if (d.maxMb) setMaxMb(d.maxMb); } })
      .catch(() => { if (live) setEnabled(false); });
    return () => { live = false; };
  }, []);

  async function pick(f: File | undefined) {
    if (!f) return;
    setError(""); setProgress(0);
    try {
      const file = await shrink(f);
      if (file.size > maxMb * 1024 * 1024) throw new Error(`Picture is too big. Max ${maxMb} MB.`);
      const res = await fetch("/api/admin/image-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType: file.type, size: file.size }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "Could not start upload.");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", d.uploadUrl);
        xhr.setRequestHeader("Content-Type", d.contentType);
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed. Check the R2 CORS setting (see guide).")));
        xhr.onerror = () => reject(new Error("Upload failed. Check your internet and the R2 CORS setting (see guide)."));
        xhr.send(file);
      });
      onChange(d.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const uploading = progress !== null;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-2">
      <p className="text-xs font-medium text-slate-300">{label}</p>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
          {value ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={value} alt="" className="h-full w-full object-contain" /> : <ImageIcon className="h-6 w-6 text-slate-600" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {enabled && (
            <>
              <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
              <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 cursor-pointer">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}{uploading ? `Uploading ${progress}%` : "Upload from gallery"}
              </button>
            </>
          )}
          {value && !uploading && <button type="button" onClick={() => onChange("")} className="flex items-center gap-1 self-start text-[11px] text-rose-300"><Trash2 className="h-3 w-3" />Remove picture</button>}
        </div>
      </div>
      {error && <p className="text-[11px] text-rose-300">{error}</p>}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={enabled ? "...or paste an https:// picture link" : "https://... picture link"} className="w-full min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-white outline-none focus:border-indigo-500" />
    </div>
  );
}
