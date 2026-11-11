"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { KeyRound, X } from "lucide-react";

/** Small "Change password" button + popup. Works for every kind of logged-in user. */
export function ChangePasswordButton({ className = "", label = false }: { className?: string; label?: boolean }) {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function save() {
    setMsg(null);
    if (next.length < 8) return setMsg({ ok: false, text: "New password must be at least 8 characters." });
    if (next !== again) return setMsg({ ok: false, text: "The two new passwords are not the same." });
    setBusy(true);
    try {
      const r = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: cur, next }) });
      const j = await r.json();
      if (!r.ok || !j.success) setMsg({ ok: false, text: j.error || "Could not change the password." });
      else { setMsg({ ok: true, text: "Password changed." }); setCur(""); setNext(""); setAgain(""); }
    } catch { setMsg({ ok: false, text: "Network error." }); }
    setBusy(false);
  }
  const inp = "w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500";
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setMsg(null); }} title="Change password" className={className || "inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-zinc-300 hover:bg-zinc-800 transition-all cursor-pointer"}>
        <KeyRound className="h-5 w-5" />{label && <span className="text-sm font-semibold">Change password</span>}
      </button>
      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold text-white">Change password</h3><button onClick={() => setOpen(false)} className="text-zinc-400 cursor-pointer"><X className="h-5 w-5" /></button></div>
            <input type={show ? "text" : "password"} className={inp} placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
            <input type={show ? "text" : "password"} className={inp} placeholder="New password (8+ characters)" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
            <input type={show ? "text" : "password"} className={inp} placeholder="New password again" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />Show passwords</label>
            {msg && <p className={`text-xs ${msg.ok ? "text-emerald-400" : "text-rose-400"}`}>{msg.text}</p>}
            <button disabled={busy || !cur || !next} onClick={save} className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-2.5 text-sm font-bold text-white disabled:opacity-50 cursor-pointer">{busy ? "Saving..." : "Save new password"}</button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
