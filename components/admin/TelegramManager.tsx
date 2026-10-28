"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  Radio,
  Save,
  Search,
  Send,
  Trash2,
  Megaphone,
  User,
} from "lucide-react";

type KeyMode = "full" | "masked" | "hidden";

interface ServerDest {
  id: string;
  name: string;
  chat_id: string;
  key_mode: KeyMode;
  enabled: boolean;
  hasToken: boolean;
  tokenHint: string;
  token_from: string;
  readOnly: boolean;
}

interface ServerView {
  storageReady: boolean;
  source: "admin" | "env" | "none";
  envAvailable: boolean;
  destinations: ServerDest[];
}

interface UiDest {
  id: string;
  name: string;
  chat_id: string;
  key_mode: KeyMode;
  enabled: boolean;
  hasToken: boolean;
  tokenHint: string;
  token_from: string;
  newToken: string;
  isNew: boolean;
}

interface FindState {
  loading: boolean;
  message?: string;
  bot?: string;
  chats: { id: string; title: string; type: string }[];
}

const SAMPLE_KEY = "AB12CD34EF56";

function maskKey(key: string) {
  if (key.length <= 4) return "****";
  const v = key.length >= 8 ? 2 : 1;
  return `${key.slice(0, v)}****${key.slice(-v)}`;
}

function newId() {
  return `d_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function tgRequest(options: RequestInit = {}) {
  // Authentication is the HttpOnly session cookie; the server re-checks the admin role.
  const response = await fetch("/api/admin/telegram", {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) throw new Error(data?.error || "Request failed.");
  return data;
}

const MODE_INFO: Record<KeyMode, { label: string; hint: string; icon: any }> = {
  full: { label: "Full key", hint: "Shows the complete key. Use for your private bot only.", icon: Eye },
  masked: { label: "Masked", hint: `Shows ${maskKey(SAMPLE_KEY)} (safe for channels).`, icon: KeyRound },
  hidden: { label: "Hidden", hint: "No key line at all.", icon: EyeOff },
};

export default function TelegramManager() {
  const [view, setView] = useState<ServerView | null>(null);
  const [dests, setDests] = useState<UiDest[]>([]);
  const [savedJson, setSavedJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [finds, setFinds] = useState<Record<string, FindState>>({});
  const [testText, setTestText] = useState<Record<string, string>>({});

  const snapshot = (list: UiDest[]) =>
    JSON.stringify(
      list.map((d) => [d.id, d.name, d.chat_id, d.key_mode, d.enabled, d.token_from, d.newToken, d.isNew])
    );

  const load = useCallback(async () => {
    try {
      setLoadError("");
      const data = (await tgRequest()) as ServerView & { success: boolean };
      setView(data);
      const list: UiDest[] = data.destinations.map((d) => ({
        id: d.id,
        name: d.name,
        chat_id: d.chat_id,
        key_mode: d.key_mode,
        enabled: d.enabled,
        hasToken: d.hasToken,
        tokenHint: d.tokenHint,
        token_from: d.token_from,
        newToken: "",
        isNew: false,
      }));
      setDests(list);
      setSavedJson(snapshot(list));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load Telegram settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => snapshot(dests) !== savedJson, [dests, savedJson]);
  const readOnly = view?.source === "env";

  const note = (id: string, ok: boolean, text: string) => setNotes((p) => ({ ...p, [id]: { ok, text } }));
  const patch = (id: string, change: Partial<UiDest>) =>
    setDests((list) => list.map((d) => (d.id === id ? { ...d, ...change } : d)));

  function addDest(kind: "personal" | "channel") {
    const d: UiDest = {
      id: newId(),
      name: kind === "personal" ? "My personal bot" : "Channel",
      chat_id: "",
      key_mode: kind === "personal" ? "full" : "masked",
      enabled: true,
      hasToken: false,
      tokenHint: "",
      token_from: "",
      newToken: "",
      isNew: true,
    };
    setDests((list) => [...list, d]);
  }

  function removeDest(d: UiDest) {
    if (!window.confirm(`Remove "${d.name}"? It will stop receiving notifications after you press Save.`)) return;
    setDests((list) =>
      list
        .filter((x) => x.id !== d.id)
        .map((x) => (x.token_from === d.id ? { ...x, token_from: "" } : x))
    );
  }

  async function save() {
    setBusy("save");
    try {
      await tgRequest({
        method: "POST",
        body: JSON.stringify({
          action: "save",
          destinations: dests.map((d) => ({
            id: d.id,
            name: d.name,
            chat_id: d.chat_id,
            key_mode: d.key_mode,
            enabled: d.enabled,
            bot_token: d.newToken.trim() || undefined,
            token_from: d.token_from || undefined,
          })),
        }),
      });
      note("_top", true, "Saved. New purchases now go to these destinations.");
      await load();
    } catch (e) {
      note("_top", false, e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy("");
    }
  }

  async function importEnv() {
    setBusy("import");
    try {
      await tgRequest({ method: "POST", body: JSON.stringify({ action: "import_env" }) });
      note("_top", true, "Your current bot was imported. You can now edit it and add more destinations.");
      await load();
    } catch (e) {
      note("_top", false, e instanceof Error ? e.message : "Could not import.");
    } finally {
      setBusy("");
    }
  }

  async function test(d: UiDest) {
    setBusy(`${d.id}:test`);
    try {
      const data = await tgRequest({ method: "POST", body: JSON.stringify({ action: "test", id: d.id, text: testText[d.id] || "" }) });
      note(d.id, !!data.ok, String(data.message || ""));
    } catch (e) {
      note(d.id, false, e instanceof Error ? e.message : "Test failed.");
    } finally {
      setBusy("");
    }
  }

  async function find(d: UiDest) {
    // The token may live on this destination, or on the destination it shares a bot with.
    const source = d.token_from ? dests.find((x) => x.id === d.token_from) : d;
    const payload: Record<string, unknown> = { action: "detect" };
    if (source?.newToken.trim()) payload.bot_token = source.newToken.trim();
    else if (source && !source.isNew) payload.id = source.id;

    if (!payload.bot_token && !payload.id) {
      setFinds((p) => ({ ...p, [d.id]: { loading: false, chats: [], message: "Paste the bot token first." } }));
      return;
    }

    setFinds((p) => ({ ...p, [d.id]: { loading: true, chats: [] } }));
    try {
      const data = await tgRequest({ method: "POST", body: JSON.stringify(payload) });
      setFinds((p) => ({
        ...p,
        [d.id]: { loading: false, chats: data.chats || [], message: data.message, bot: data.bot },
      }));
    } catch (e) {
      setFinds((p) => ({
        ...p,
        [d.id]: { loading: false, chats: [], message: e instanceof Error ? e.message : "Search failed." },
      }));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (loadError || !view) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-300">
        {loadError || "Could not load Telegram settings."}
      </div>
    );
  }

  const top = notes["_top"];

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <Bell className="h-5 w-5 text-sky-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Telegram Notifications</h2>
            <p className="text-xs text-slate-400">Every purchase is sent to each destination below.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => addDest("personal")}
            disabled={readOnly || !view.storageReady}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Personal bot
          </button>
          <button
            onClick={() => addDest("channel")}
            disabled={readOnly || !view.storageReady}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Channel / group
          </button>
          <button
            onClick={save}
            disabled={!dirty || busy === "save" || readOnly}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save changes
          </button>
        </div>
      </div>

      {!view.storageReady && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Run <span className="font-mono">supabase/PAYMENT_GATEWAY_SWITCH.sql</span> in the Supabase SQL editor once, then refresh.
            Until then notifications keep using the bot from your server settings.
          </p>
        </div>
      )}

      {readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4 text-xs text-sky-200">
          <p className="max-w-xl leading-relaxed">
            Notifications currently use the bot saved in your server settings (<span className="font-mono">TELEGRAM_BOT_TOKEN</span>).
            Import it here to edit it and add more bots or channels.
          </p>
          <button
            onClick={importEnv}
            disabled={busy === "import" || !view.storageReady}
            className="text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 px-3.5 py-2 rounded-lg cursor-pointer"
          >
            {busy === "import" ? "Importing..." : "Import it here"}
          </button>
        </div>
      )}

      {view.source === "none" && dests.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center text-sm text-slate-400">
          No Telegram destinations yet. Press <span className="text-slate-200 font-semibold">Personal bot</span> to receive full keys yourself, or{" "}
          <span className="text-slate-200 font-semibold">Channel / group</span> to post masked keys publicly.
        </div>
      )}

      {top && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
            top.ok ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-rose-500/25 bg-rose-500/10 text-rose-300"
          }`}
        >
          {top.ok ? <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
          <span>{top.text}</span>
        </div>
      )}

      {/* destinations */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {dests.map((d) => {
          const f = finds[d.id];
          const n = notes[d.id];
          const sharable = dests.filter((x) => x.id !== d.id && !x.token_from && (x.hasToken || x.newToken.trim()));
          const isGroupLike = d.chat_id.startsWith("-") || d.chat_id.startsWith("@");
          const sample =
            d.key_mode === "full" ? SAMPLE_KEY : d.key_mode === "masked" ? maskKey(SAMPLE_KEY) : null;
          const disabledEdit = readOnly;

          return (
            <div
              key={d.id}
              className={`rounded-2xl border bg-slate-900/60 p-5 space-y-4 ${
                d.enabled ? "border-slate-800" : "border-slate-800 opacity-70"
              }`}
            >
              {/* title row */}
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-800 flex items-center justify-center">
                  {d.chat_id.startsWith("-") || d.chat_id.startsWith("@") ? (
                    <Megaphone className="h-4 w-4 text-sky-400" />
                  ) : (
                    <User className="h-4 w-4 text-indigo-400" />
                  )}
                </div>
                <input
                  value={d.name}
                  disabled={disabledEdit}
                  onChange={(e) => patch(d.id, { name: e.target.value })}
                  maxLength={40}
                  className="flex-1 min-w-0 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-sm font-bold text-white"
                />
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={d.enabled}
                    disabled={disabledEdit}
                    onChange={(e) => patch(d.id, { enabled: e.target.checked })}
                    className="accent-emerald-500"
                  />
                  On
                </label>
                {!disabledEdit && (
                  <button
                    onClick={() => removeDest(d)}
                    className="text-slate-500 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
                    aria-label="Remove destination"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* bot token */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Bot</span>
                {sharable.length > 0 && (
                  <select
                    value={d.token_from}
                    disabled={disabledEdit}
                    onChange={(e) => patch(d.id, { token_from: e.target.value, newToken: "" })}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 focus:border-indigo-500 outline-none px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="">Use a different bot (enter its token)</option>
                    {sharable.map((x) => (
                      <option key={x.id} value={x.id}>
                        Same bot as: {x.name}
                      </option>
                    ))}
                  </select>
                )}
                {!d.token_from && (
                  <input
                    type="password"
                    autoComplete="new-password"
                    disabled={disabledEdit}
                    value={d.newToken}
                    onChange={(e) => patch(d.id, { newToken: e.target.value })}
                    placeholder={d.hasToken ? `Saved ${d.tokenHint} (leave empty to keep)` : "Paste the bot token from @BotFather"}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 focus:border-indigo-500 outline-none px-3 py-2 text-xs font-mono text-slate-200"
                  />
                )}
              </div>

              {/* chat id */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Chat / channel ID</span>
                <div className="flex gap-2">
                  <input
                    value={d.chat_id}
                    disabled={disabledEdit}
                    onChange={(e) => patch(d.id, { chat_id: e.target.value })}
                    placeholder="-1001234567890  or  @mychannel"
                    spellCheck={false}
                    className="flex-1 min-w-0 rounded-lg bg-slate-950 border border-slate-700 focus:border-indigo-500 outline-none px-3 py-2 text-xs font-mono text-slate-200"
                  />
                  {!disabledEdit && (
                    <button
                      onClick={() => find(d)}
                      disabled={f?.loading}
                      className="flex items-center gap-1.5 shrink-0 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors cursor-pointer"
                    >
                      {f?.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                      Find chat ID
                    </button>
                  )}
                </div>

                {f && !f.loading && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 space-y-2">
                    {f.bot && <p className="text-[11px] text-slate-500">Bot: <span className="text-slate-300">{f.bot}</span></p>}
                    {f.chats.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {f.chats.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => patch(d.id, { chat_id: c.id })}
                            className="text-[11px] text-left text-slate-200 bg-slate-800 hover:bg-indigo-600/30 border border-slate-700 hover:border-indigo-500/50 rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors"
                          >
                            <span className="font-semibold">{c.title}</span>{" "}
                            <span className="text-slate-500">
                              {c.type} · <span className="font-mono">{c.id}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-300 leading-relaxed">{f.message}</p>
                    )}
                  </div>
                )}
              </div>

              {/* key mode */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">What this chat sees of the key</span>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(MODE_INFO) as KeyMode[]).map((m) => {
                    const Icon = MODE_INFO[m].icon;
                    const active = d.key_mode === m;
                    return (
                      <button
                        key={m}
                        disabled={disabledEdit}
                        onClick={() => patch(d.id, { key_mode: m })}
                        className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[11px] font-semibold transition-colors cursor-pointer disabled:cursor-default ${
                          active
                            ? "border-indigo-500/60 bg-indigo-500/15 text-white"
                            : "border-slate-700 bg-slate-950/50 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {MODE_INFO[m].label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500">{MODE_INFO[d.key_mode].hint}</p>

                {d.key_mode === "full" && isGroupLike && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>This looks like a channel or group. Everyone in it will see the complete key. Pick Masked unless that&apos;s what you want.</span>
                  </div>
                )}
              </div>

              {/* preview */}
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2.5 text-[11px] leading-relaxed text-slate-400 font-mono">
                <div className="text-slate-300">🛒 New Purchase via Wallet</div>
                <div>👤 User : demo_user · 📦 Sample · 💰 ₹100</div>
                {sample && <div className="text-sky-300">🔑 Key : {sample}</div>}
                <div className="text-emerald-400">✅ Key Released</div>
              </div>

              {/* editable test message */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Test message <span className="normal-case text-slate-500">(edit it, or leave empty for the sample above)</span>
                </span>
                <textarea
                  value={testText[d.id] || ""}
                  onChange={(e) => setTestText((p) => ({ ...p, [d.id]: e.target.value }))}
                  maxLength={1000}
                  rows={3}
                  placeholder="Type your own test message here, e.g. Hello from JPRIME store"
                  className="w-full resize-y rounded-lg bg-slate-950 border border-slate-700 focus:border-indigo-500 outline-none px-3 py-2 text-xs text-slate-200"
                />
              </div>

              {/* actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => test(d)}
                  disabled={!!busy || dirty || d.isNew}
                  title={dirty || d.isNew ? "Save your changes first" : "Send a sample message"}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {busy === `${d.id}:test` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Send test message
                </button>
                {(dirty || d.isNew) && <span className="text-[11px] text-slate-500">Save first to test.</span>}
              </div>

              {n && (
                <div
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                    n.ok ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-rose-500/25 bg-rose-500/10 text-rose-300"
                  }`}
                >
                  {n.ok ? <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                  <span className="break-words">{n.text}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* help */}
      <details className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400 leading-relaxed">
        <summary className="cursor-pointer select-none font-semibold text-slate-200 flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-sky-400" /> How to set this up (step by step)
        </summary>
        <div className="mt-3 space-y-3">
          <div>
            <p className="font-semibold text-slate-200">1. Create a new bot (once)</p>
            <p>Open Telegram, search <span className="font-mono text-slate-300">@BotFather</span>, send <span className="font-mono text-slate-300">/newbot</span>, choose a name, and copy the token it gives you. Paste it in the Bot box.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-200">2. Personal bot (you see the full key)</p>
            <p>Open your bot in Telegram and press <span className="text-slate-300">Start</span>, then send &ldquo;hi&rdquo;. Back here press <span className="text-slate-300">Find chat ID</span> and click your name. Choose <span className="text-slate-300">Full key</span>.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-200">3. Channel or group (masked key such as {maskKey(SAMPLE_KEY)})</p>
            <p>Add the bot to the channel as an <span className="text-slate-300">Administrator</span> with &ldquo;Post messages&rdquo;. Post any message in the channel, then press <span className="text-slate-300">Find chat ID</span> and click the channel. For a public channel you can also just type <span className="font-mono text-slate-300">@channelname</span>. Choose <span className="text-slate-300">Masked</span>.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-200">4. More channels</p>
            <p>Press <span className="text-slate-300">Channel / group</span> again and pick <span className="text-slate-300">Same bot as…</span> so you don&apos;t paste the token twice. You can use as many channels as you like.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-200">5. Save, then test</p>
            <p>Press <span className="text-slate-300">Save changes</span>, then <span className="text-slate-300">Send test message</span> on each destination.</p>
          </div>
          <p className="text-slate-500">Bot tokens are stored on the server only and are never shown again, just the last 4 characters.</p>
        </div>
      </details>
    </div>
  );
}