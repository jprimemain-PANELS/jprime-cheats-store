"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Loader2, Trash2, UploadCloud } from "lucide-react";

const EXT_TYPES: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mkv: "video/x-matroska", avi: "video/x-msvideo" };

/**
 * Product video: pick from the phone gallery -> goes straight to Cloudflare R2 (not Supabase / Vercel).
 * Only the link is saved in the product. Pasting a YouTube / video link still works.
 */
export default function VideoUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [maxMb, setMaxMb] = useState(200);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/video-upload", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (live) { setEnabled(!!d.enabled); if (d.maxMb) setMaxMb(d.maxMb); } })
      .catch(() => { if (live) setEnabled(false); });
    return () => { live = false; xhrRef.current?.abort(); };
  }, []);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const contentType = file.type || EXT_TYPES[ext] || "";
    if (file.size > maxMb * 1024 * 1024) { setError(`Video is too big. Max ${maxMb} MB.`); return; }
    setProgress(0);
    try {
      const res = await fetch("/api/admin/video-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType, size: file.size }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "Could not start upload.");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", d.uploadUrl);
        xhr.setRequestHeader("Content-Type", d.contentType);
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed. Check the R2 CORS setting (see guide).")));
        xhr.onerror = () => reject(new Error("Upload failed. Check your internet and the R2 CORS setting (see guide)."));
        xhr.onabort = () => reject(new Error("Upload cancelled."));
        xhr.send(file);
      });
      onChange(d.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setProgress(null);
      xhrRef.current = null;
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const uploading = progress !== null;
  const isOwnUpload = /\/videos\/[A-Za-z0-9-]+\/\d+-[a-f0-9]+\.\w+$/.test(value || "");

  return (
    <div className="space-y-3">
      {enabled && (
        <>
          <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-sky-500/50 bg-sky-500/5 px-4 py-6 text-center transition-colors hover:bg-sky-500/10 disabled:opacity-70"
          >
            {uploading ? <Loader2 className="h-7 w-7 animate-spin text-sky-300" /> : <UploadCloud className="h-7 w-7 text-sky-300" />}
            <span className="text-sm font-semibold text-white">{uploading ? `Uploading... ${progress}%` : "Tap to upload video from gallery"}</span>
            <span className="text-[11px] text-zinc-400">MP4, WebM, MOV, MKV, AVI · Max {maxMb}MB</span>
            {uploading && <span className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"><span className="block h-full bg-sky-400 transition-all" style={{ width: `${progress}%` }} /></span>}
          </button>
          {uploading && <p className="text-[11px] text-amber-300">Keep this page open until it reaches 100%.</p>}
        </>
      )}

      {value && !uploading && (
        <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-2.5 text-xs text-zinc-300">
          <Film className="h-4 w-4 shrink-0 text-sky-300" />
          <span className="min-w-0 flex-1 truncate">{isOwnUpload ? "Uploaded video attached" : value}</span>
          <button type="button" onClick={() => onChange("")} className="shrink-0 rounded-lg p-1.5 text-red-300 hover:bg-red-500/10" aria-label="Remove video"><Trash2 className="h-4 w-4" /></button>
        </div>
      )}

      {error && <p className="text-xs text-red-300">{error}</p>}

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3"
        placeholder={enabled ? "...or paste a YouTube / video link" : "https://... (YouTube or direct video link)"}
      />
    </div>
  );
}
