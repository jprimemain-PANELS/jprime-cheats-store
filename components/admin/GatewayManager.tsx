"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  KeyRound,
  Loader2,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";

type GatewayId = "xyz" | "anuj";

interface GatewayInfo {
  id: GatewayId;
  label: string;
  description: string;
  needsUtr: boolean;
  createUrl: string;
  verifyUrl: string;
  defaultCreateUrl: string;
  defaultVerifyUrl: string;
  keySource: "admin" | "env" | "missing";
  keyHint: string;
  envKey: string;
}

interface GatewayView {
  storageReady: boolean;
  active: GatewayId;
  activeFrom: "admin" | "env-default";
  gateways: Record<GatewayId, GatewayInfo>;
}

interface EditState {
  apiKey: string;
  createUrl: string;
  verifyUrl: string;
}

const IDS: GatewayId[] = ["xyz", "anuj"];

async function gatewayRequest(options: RequestInit = {}) {
  // Authentication is the HttpOnly session cookie; the server re-checks the admin role.
  const response = await fetch("/api/admin/gateway", {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || "Request failed.");
  }
  return data;
}

export default function GatewayManager() {
  const [view, setView] = useState<GatewayView | null>(null);
  const [edit, setEdit] = useState<Record<GatewayId, EditState> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<string>("");
  const [notes, setNotes] = useState<Partial<Record<GatewayId, { ok: boolean; text: string }>>>({});

  const load = useCallback(async () => {
    try {
      setLoadError("");
      const data = (await gatewayRequest()) as GatewayView & { success: boolean };
      setView(data);
      setEdit({
        xyz: { apiKey: "", createUrl: data.gateways.xyz.createUrl, verifyUrl: data.gateways.xyz.verifyUrl },
        anuj: { apiKey: "", createUrl: data.gateways.anuj.createUrl, verifyUrl: data.gateways.anuj.verifyUrl },
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load gateway settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const note = (id: GatewayId, ok: boolean, text: string) =>
    setNotes((prev) => ({ ...prev, [id]: { ok, text } }));

  async function run(id: GatewayId, tag: string, payload: Record<string, unknown>, okText?: string) {
    setBusy(`${id}:${tag}`);
    try {
      const data = await gatewayRequest({ method: "POST", body: JSON.stringify({ gateway: id, ...payload }) });
      if (tag === "test") {
        note(id, !!data.ok, String(data.message || ""));
      } else {
        note(id, true, okText || "Saved.");
        await load();
      }
    } catch (e) {
      note(id, false, e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  }

  function activate(id: GatewayId) {
    if (!view) return;
    const g = view.gateways[id];
    if (g.keySource === "missing") {
      note(id, false, `Add an API key first (or set ${g.envKey} in Vercel).`);
      return;
    }
    if (!window.confirm(`Switch NEW payments to ${g.label}?\n\nOrders already created keep using the gateway they were created on.`)) return;
    run(id, "activate", { action: "set_active" }, `${g.label} is now the active gateway.`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (loadError || !view || !edit) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-300">
        {loadError || "Could not load gateway settings."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Payment Gateway</h2>
            <p className="text-xs text-slate-400">Choose which UPI gateway creates NEW orders.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 rounded-full">
          <Zap className="h-3.5 w-3.5" />
          Active: {view.gateways[view.active].label}
        </div>
      </div>

      {!view.storageReady && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">One-time setup needed</p>
            <p className="text-amber-200/80">
              Run <span className="font-mono">supabase/PAYMENT_GATEWAY_SWITCH.sql</span> in the Supabase SQL editor, then refresh this tab.
              Until then the gateway can&apos;t be switched here and the site uses the environment defaults
              ({view.gateways[view.active].label}).
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {IDS.map((id) => {
          const g = view.gateways[id];
          const e = edit[id];
          const isActive = view.active === id;
          const n = notes[id];
          const urlsChanged = e.createUrl !== g.createUrl || e.verifyUrl !== g.verifyUrl;
          const urlsAreDefault = g.createUrl === g.defaultCreateUrl && g.verifyUrl === g.defaultVerifyUrl;

          return (
            <div
              key={id}
              className={`rounded-2xl border p-5 space-y-4 bg-slate-900/60 ${
                isActive ? "border-emerald-500/40 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]" : "border-slate-800"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">{g.label}</h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">{g.description}</p>
                </div>
                {isActive ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full shrink-0">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </span>
                ) : (
                  <button
                    onClick={() => activate(id)}
                    disabled={!!busy || !view.storageReady}
                    className="text-[11px] font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    {busy === `${id}:activate` ? "Switching..." : "Use this"}
                  </button>
                )}
              </div>

              {/* key status */}
              <div className="flex items-center gap-2 text-xs">
                <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                {g.keySource === "missing" ? (
                  <span className="text-rose-400">No API key. Add one below or set {g.envKey} in Vercel.</span>
                ) : (
                  <span className="text-slate-300">
                    API key <span className="font-mono text-slate-400">{g.keyHint}</span>{" "}
                    <span className="text-slate-500">
                      ({g.keySource === "admin" ? "saved here" : `from ${g.envKey}`})
                    </span>
                  </span>
                )}
              </div>

              {/* fields */}
              <div className="space-y-3">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Create order URL</span>
                  <input
                    value={e.createUrl}
                    onChange={(ev) => setEdit({ ...edit, [id]: { ...e, createUrl: ev.target.value } })}
                    spellCheck={false}
                    className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 focus:border-indigo-500 outline-none px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Verify payment URL</span>
                  <input
                    value={e.verifyUrl}
                    onChange={(ev) => setEdit({ ...edit, [id]: { ...e, verifyUrl: ev.target.value } })}
                    spellCheck={false}
                    className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 focus:border-indigo-500 outline-none px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    API key {g.keySource !== "missing" && <span className="normal-case text-slate-500">(leave empty to keep current)</span>}
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={e.apiKey}
                    onChange={(ev) => setEdit({ ...edit, [id]: { ...e, apiKey: ev.target.value } })}
                    placeholder={g.keySource === "missing" ? "Paste API key" : "•••••••• (unchanged)"}
                    className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 focus:border-indigo-500 outline-none px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>
              </div>

              {/* buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    run(
                      id,
                      "save",
                      {
                        action: "save_config",
                        createUrl: e.createUrl,
                        verifyUrl: e.verifyUrl,
                        ...(e.apiKey.trim() ? { apiKey: e.apiKey } : {}),
                      },
                      "Settings saved."
                    )
                  }
                  disabled={!!busy || !view.storageReady || (!urlsChanged && !e.apiKey.trim())}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {busy === `${id}:save` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </button>

                <button
                  onClick={() => run(id, "test", { action: "test" })}
                  disabled={!!busy}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {busy === `${id}:test` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Test connection
                </button>

                {!urlsAreDefault && (
                  <button
                    onClick={() => run(id, "reset", { action: "save_config", resetUrls: true }, "URLs reset to defaults.")}
                    disabled={!!busy || !view.storageReady}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white px-2.5 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset URLs
                  </button>
                )}

                {g.keySource === "admin" && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Remove the API key saved here for ${g.label}? (An env key, if any, will be used instead.)`)) {
                        run(id, "clear", { action: "save_config", clearKey: true }, "Saved key removed.");
                      }
                    }}
                    disabled={!!busy}
                    className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 px-2.5 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove key
                  </button>
                )}
              </div>

              {n && (
                <div
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                    n.ok
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                      : "border-rose-500/25 bg-rose-500/10 text-rose-300"
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

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400 leading-relaxed space-y-1.5">
        <p>• Switching affects <span className="text-slate-200">new</span> orders only. A payment already in progress is always verified on the gateway that created it.</p>
        <p>• API keys are stored server-side and are never sent back to this page; only the last 4 characters are shown.</p>
        <p>• &ldquo;Test connection&rdquo; looks up a fake order. It creates nothing and moves no money.</p>
      </div>
    </div>
  );
}
