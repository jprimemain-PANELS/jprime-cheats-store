"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Send } from "lucide-react";

const field = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500";

export default function StoreTelegramManager() {
  const [v, setV] = useState<any>(null);
  const [token, setToken] = useState("");
  const [chat, setChat] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState("hidden");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const r = await fetch("/api/admin/store-telegram", { cache: "no-store" }); const j = await r.json();
    if (j.success) { setV(j); setChat(j.chatId); setEnabled(j.hasToken ? j.enabled : true); setMode(j.keyMode); }
  }
  useEffect(() => { load(); }, []);

  async function call(body: any) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/store-telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      setMsg(j.success && j.ok !== false ? { ok: true, text: j.message || "Saved." } : { ok: false, text: j.error || j.message || "Failed." });
      if (body.action !== "test") { setToken(""); await load(); }
    } catch { setMsg({ ok: false, text: "Network error." }); }
    setBusy(false);
  }

  if (!v) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  return (
    <div className="space-y-4 max-w-xl">
      <h2 className="text-lg font-bold text-white">Telegram alerts for your store</h2>
      <p className="text-xs text-slate-400">Get a message on Telegram every time a customer buys. Takes 3 minutes.</p>
      <ol className="text-xs text-slate-300 list-decimal pl-5 space-y-1">
        <li>Open Telegram, search <b>@BotFather</b>, send <code>/newbot</code>, follow the questions. Copy the <b>token</b> it gives you.</li>
        <li>Open your new bot and press Start (so it can message you).</li>
        <li>Get your <b>Chat ID</b>: message <b>@userinfobot</b>, it replies with your number. (For a group or channel, add the bot there and use the group/channel ID.)</li>
        <li>Paste both below and press Save, then press Send test.</li>
      </ol>
      {msg && <div className={`rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>{msg.text}</div>}
      <label className="block text-xs text-slate-400">Bot token {v.hasToken && <span>(saved {v.tokenHint}, leave empty to keep)</span>}
        <input className={field} type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456789:AA..." /></label>
      <label className="block text-xs text-slate-400">Chat ID<input className={field} value={chat} onChange={(e) => setChat(e.target.value)} placeholder="123456789" /></label>
      <label className="block text-xs text-slate-400">Show customer licence key in the alert
        <select className={field} value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="hidden">Never (safest)</option><option value="masked">Partly hidden</option><option value="full">Full key</option>
        </select></label>
      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />Alerts on</label>
      <div className="flex gap-2">
        <button disabled={busy} onClick={() => call({ botToken: token, chatId: chat, enabled, keyMode: mode })} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save</button>
        <button disabled={busy} onClick={() => call({ action: "test" })} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 text-sm cursor-pointer disabled:opacity-50"><Send className="h-4 w-4" />Send test</button>
      </div>
    </div>
  );
}
