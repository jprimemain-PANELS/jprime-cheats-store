"use client";

import { useState } from "react";
import { RefreshCw, Smartphone, Monitor } from "lucide-react";

/** Shows the real store (saved version) under the editor so changes can be checked without logging out. */
export default function LivePreview({ version }: { version: number }) {
  const [mode, setMode] = useState<"phone" | "desktop">("phone");
  const [manual, setManual] = useState(0);
  const [shown, setShown] = useState(false);
  const btn = (on: boolean) => `flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${on ? "border-indigo-500 bg-indigo-500/15 text-white" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white">Live preview of your website</h3>
          <p className="text-[11px] text-slate-400">Press Save above and the preview updates by itself.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setMode("phone")} className={btn(mode === "phone")}><Smartphone className="h-3.5 w-3.5" />Phone</button>
          <button onClick={() => setMode("desktop")} className={btn(mode === "desktop")}><Monitor className="h-3.5 w-3.5" />Desktop</button>
          <button onClick={() => setManual((n) => n + 1)} className={btn(false)} title="Reload preview"><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
        </div>
      </div>
      {!shown ? (
        <button onClick={() => setShown(true)} className="w-full rounded-xl border border-dashed border-slate-700 py-10 text-sm font-semibold text-slate-300 hover:bg-slate-800/50 cursor-pointer">Show live preview</button>
      ) : (
      <div className="flex justify-center overflow-hidden rounded-xl bg-black/40 p-2">
        <iframe
          key={`${version}-${manual}`}
          src="/"
          title="Website preview"
          className="rounded-lg border border-slate-700 bg-black"
          style={mode === "phone" ? { width: 390, maxWidth: "100%", height: "min(720px, 75vh)" } : { width: "100%", height: "min(720px, 75vh)" }}
        />
      </div>
      )}
    </div>
  );
}
