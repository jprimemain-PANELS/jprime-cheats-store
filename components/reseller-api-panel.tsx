"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, KeyRound, Loader2, RefreshCw, Search, ShieldAlert, Trash2, Wallet } from "lucide-react";

type Item = { product_id: number; group_id: number; product: string; duration: string; category: string; price: number; status: string; delivery: string; stock: number | null; in_stock: boolean };
type Panel = { key: { hasKey: boolean; hint: string; masterHint: string; createdAt: string | null; lastUsed: string | null }; items: Item[]; balance: number };

function Copy1({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1400); } catch {} }}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-bold cursor-pointer hover:border-violet-400 ${className}`}>
      {ok ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}{ok ? "Copied" : label}
    </button>
  );
}

const Code = ({ children }: { children: string }) => (
  <div className="relative">
    <pre className="max-w-full overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3 pr-20 text-[11px] leading-relaxed whitespace-pre text-white/85">{children}</pre>
    <Copy1 text={children} className="absolute right-2 top-2" />
  </div>
);

/** The "API" tab on a reseller's home page: key, endpoints for every supported style, and the product list with Product IDs. */
export function ResellerApiPanel() {
  const [data, setData] = useState<Panel | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState("");
  const [freshMaster, setFreshMaster] = useState("");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"native" | "s1" | "s2" | "s3">("native");
  const [lang, setLang] = useState<"node" | "php" | "python">("node");
  const base = typeof window !== "undefined" ? window.location.origin : "";

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/reseller/panel", { cache: "no-store" });
      const j = await r.json();
      if (!j?.success) { setErr(j?.error || "Could not load."); return; }
      setData({ key: j.key, items: j.items, balance: j.balance }); setErr("");
    } catch { setErr("Could not load. Check your connection."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (action: "generate" | "revoke") => {
    if (action === "generate" && data?.key.hasKey && !confirm("Create a new key? Your old key stops working immediately (update your bot / website).")) return;
    if (action === "revoke" && !confirm("Turn the API off? Your key stops working immediately.")) return;
    setBusy(true);
    try {
      const r = await fetch("/api/reseller/panel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await r.json();
      if (!j?.success) setErr(j?.error || "Failed."); else { setFresh(action === "generate" ? j.key : ""); setFreshMaster(action === "generate" ? j.master : ""); await load(); }
    } catch { setErr("Failed. Try again."); }
    setBusy(false);
  };

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.items ?? []).filter((i) => !s || `${i.product} ${i.duration} ${i.product_id}`.toLowerCase().includes(s));
  }, [data, q]);
  const sample = items.find((i) => i.in_stock) ?? data?.items[0];
  const pid = sample?.product_id ?? 1001;
  const KEY = fresh || "YOUR_API_KEY";
  const grp = sample?.group_id ?? 1;
  const dur = sample?.duration ?? "1 day";

  const docs: Record<typeof tab, { title: string; hint: string; url: string; code: string }> = {
    native: { title: "Standard JSON API", hint: "Best for new bots and websites.", url: `${base}/api/reseller/v1`, code:
`# check wallet
curl ${base}/api/reseller/v1/balance -H "Authorization: Bearer ${KEY}"

# list products (your price + Product ID + stock)
curl ${base}/api/reseller/v1/products -H "Authorization: Bearer ${KEY}"

# buy 1 key
curl -X POST ${base}/api/reseller/v1/buy \\
  -H "Authorization: Bearer ${KEY}" -H "Content-Type: application/json" \\
  -d '{"product_id": ${pid}, "idempotency_key": "order-1001"}'

# -> {"success":true,"key":"...","order":"RA-...","price":120,"balance":880}` },
    s1: { title: "Style 1 (bb team style: api key + master key + product id + duration)", hint: "For websites and bots made for bb team: fill API key, Master key, Product ID and Duration from this tab. If your bot has no master key field, leave it empty.", url: `${base}/api/reseller/compat/s1`, code:
`curl -X POST ${base}/api/reseller/compat/s1 \\
  -H "x-master-key: YOUR_MASTER_KEY" \\
  -d "api_key=${KEY}" -d "action=buy" -d "product_id=${grp}" -d "duration=${dur}"

# product_id = the Group ID of the product (see list below), duration = the plan name (or its number)
# you can also send just the plan's Product ID:  -d "product_id=${pid}"
# -> {"status":"success","data":{"key":"...","balance":880}}
# extra actions: action=balance, action=products, action=stock&product_id=${pid}` },
    s2: { title: "Style 2 (X-API-Token + variant_id)", hint: "For bots already made for 'whitex' style sellers. variant_id = Product ID.", url: `${base}/api/reseller/compat/s2`, code:
`curl -X POST ${base}/api/reseller/compat/s2 \\
  -H "X-API-Token: ${KEY}" -d "variant_id=${pid}" -d "quantity=1"

# -> {"success":true,"keys":["..."],"balance":880}` },
    s3: { title: "Style 3 (Bearer + JSON product_id)", hint: "For bots already made for 'tahir' style sellers.", url: `${base}/api/reseller/compat/s3`, code:
`curl -X POST ${base}/api/reseller/compat/s3 \\
  -H "Authorization: Bearer ${KEY}" -H "Content-Type: application/json" \\
  -d '{"product_id": ${pid}, "quantity": 1, "idempotency_key": "order-1001"}'

# -> {"ok":true,"data":{"keys":["..."],"balance":880}}` },
  };
  const d = docs[tab];
  const U = `${base}/api/reseller/v1/buy`;
  const LANGS: Record<typeof lang, string> = {
    node: `const r = await fetch("${U}", {
  method: "POST",
  headers: { Authorization: "Bearer " + process.env.STORE_API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ product_id: ${pid}, idempotency_key: "order-1001" }),
});
const j = await r.json();
if (j.success) console.log("KEY:", j.key); else console.log("Error:", j.error);`,
    php: `$ch = curl_init("${U}");
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ["Authorization: Bearer " . getenv("STORE_API_KEY"), "Content-Type: application/json"],
  CURLOPT_POSTFIELDS => json_encode(["product_id" => ${pid}, "idempotency_key" => "order-1001"])]);
$j = json_decode(curl_exec($ch), true);
echo $j["success"] ? $j["key"] : $j["error"];`,
    python: `import os, requests
r = requests.post("${U}", timeout=30,
    headers={"Authorization": "Bearer " + os.environ["STORE_API_KEY"]},
    json={"product_id": ${pid}, "idempotency_key": "order-1001"})
j = r.json()
print(j["key"] if j.get("success") else j.get("error"))`,
  };

  if (err && !data) return <div className="mx-auto max-w-xl rounded-2xl border border-white/10 px-6 py-10 text-center text-sm">{err}</div>;
  if (!data) return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-violet-400" /></div>;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 text-left" data-reseller-api>
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/20 text-violet-300"><KeyRound className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-extrabold">Reseller API</h3>
            <p className="text-xs text-white/60">Connect your own bot or website. Every purchase is paid from your wallet at your reseller price.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-1.5 text-sm font-bold"><Wallet className="h-4 w-4" />₹{data.balance.toFixed(2)}</span>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
          {fresh ? (
            <>
              <p className="flex items-center gap-2 text-sm font-bold text-amber-300"><ShieldAlert className="h-4 w-4" />Copy your key now. It is shown only once.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-black/40 px-3 py-2 text-xs">{fresh}</code><Copy1 text={fresh} label="Copy key" /></div>
              {freshMaster && <><p className="mt-3 text-xs font-bold text-white/70">Master key (only needed by bots / websites that ask for a "master key", e.g. bb team style)</p>
              <div className="mt-2 flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-black/40 px-3 py-2 text-xs">{freshMaster}</code><Copy1 text={freshMaster} label="Copy master" /></div></>}
            </>
          ) : data.key.hasKey ? (
            <p className="text-sm">API key <b>rk_{data.key.hint}</b> is active{data.key.masterHint ? <span className="text-white/60"> · master key rm_{data.key.masterHint}</span> : null}{data.key.lastUsed ? <span className="text-white/60"> · last used {new Date(data.key.lastUsed).toLocaleString()}</span> : <span className="text-white/60"> · not used yet</span>}</p>
          ) : (
            <p className="text-sm text-white/70">You do not have an API key yet. Create one to start.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => act("generate")} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-xs font-bold text-white cursor-pointer disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{data.key.hasKey ? "Create new key" : "Generate API key"}</button>
            {data.key.hasKey && <button type="button" disabled={busy} onClick={() => act("revoke")} className="inline-flex items-center gap-2 rounded-xl border border-red-400/40 px-4 py-2.5 text-xs font-bold text-red-300 cursor-pointer"><Trash2 className="h-4 w-4" />Turn off</button>}
          </div>
        </div>
        {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <h4 className="text-sm font-extrabold">Connect in 1 minute</h4>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-white/70">
          <li>Generate your key above.</li>
          <li>In your bot or website put this <b>base URL</b> and the key.</li>
          <li>Use the <b>Product ID</b> from the list below for each product.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["native", "s1", "s2", "s3"] as const).map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full border px-3.5 py-1.5 text-xs font-bold cursor-pointer ${tab === t ? "border-transparent bg-violet-600 text-white" : "border-white/15"}`}>{t === "native" ? "Standard" : `Style ${t.slice(1)}`}</button>)}
        </div>
        <p className="mt-3 text-sm font-bold">{d.title}</p>
        <p className="text-xs text-white/60">{d.hint}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-black/30 px-3 py-2 text-xs">{d.url}</code><Copy1 text={d.url} label="Copy URL" /></div>
        <div className="mt-3"><Code>{d.code}</Code></div>
        <p className="mt-3 text-[11px] text-white/50">Tip: send an <b>idempotency_key</b> (your order id) so a retry never buys twice. Limit: 120 requests per minute.</p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <h4 className="text-sm font-extrabold">Full guide</h4>
        <p className="mt-1 text-xs text-white/60">Everything you need is here. Use your key in the header <b>Authorization: Bearer YOUR_API_KEY</b> (also accepted: <b>X-API-Key</b>, <b>X-API-Token</b> or <b>api_key</b>). Call the API from your server or bot only, never from a public web page. Limit: 120 requests per minute.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[440px] text-left text-xs">
          <thead><tr className="text-white/50"><th className="py-1.5 pr-3 font-bold">Call</th><th className="py-1.5 font-bold">What it does</th></tr></thead>
          <tbody className="divide-y divide-white/10">
            {[["GET /balance","Your wallet balance"],["GET /products","All products: product_id, name, duration, your price, stock (?category=mobile, ?q=text)"],["GET /stock?product_id=ID","in_stock and stock count for one product"],["POST /buy","Body {\"product_id\":ID,\"idempotency_key\":\"your-order-id\"} returns the key, order, price, balance"],["GET /orders","Your recent API orders with their keys"]].map(([a, b]) => <tr key={a}><td className="py-2 pr-3 font-mono font-bold whitespace-nowrap">{a}</td><td className="py-2 text-white/70">{b}</td></tr>)}
          </tbody></table></div>
        <p className="mt-2 text-[11px] text-white/50">All paths start with {base}/api/reseller/v1</p>
        <h5 className="mt-5 text-xs font-extrabold">Answers (errors)</h5>
        <ul className="mt-1.5 grid gap-1 text-xs text-white/70 sm:grid-cols-2">
          <li><b>401</b> wrong, missing or turned-off key</li><li><b>402</b> wallet too low: add money on the website</li>
          <li><b>404</b> unknown product_id</li><li><b>409</b> out of stock, maintenance or another purchase running</li>
          <li><b>429</b> too many requests, wait a minute</li><li><b>502</b> delivery failed: you are NOT charged</li>
        </ul>
        <h5 className="mt-5 text-xs font-extrabold">Code examples (buy 1 key)</h5>
        <div className="mt-2 flex flex-wrap gap-2">{(["node", "php", "python"] as const).map((l) => <button key={l} type="button" onClick={() => setLang(l)} className={`rounded-full border px-3.5 py-1.5 text-xs font-bold cursor-pointer ${lang === l ? "border-transparent bg-violet-600 text-white" : "border-white/15"}`}>{l === "node" ? "Node.js / Telegram bot" : l === "php" ? "PHP website" : "Python bot"}</button>)}</div>
        <div className="mt-3"><Code>{LANGS[lang]}</Code></div>
        <h5 className="mt-5 text-xs font-extrabold">Good to know</h5>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-white/70">
          <li>Always send an <b>idempotency_key</b> (your order id). If your server retries, you get the same key and are not charged twice.</li>
          <li>Check <b>in_stock</b> before selling and keep your wallet topped up.</li>
          <li>If your key leaks, press <b>Create new key</b>: the old one stops at once.</li>
          <li>Your bot already works with another seller API? Use <b>Style 1, 2 or 3</b> above: change only the URL, key and product IDs.</li>
        </ul>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h4 className="text-sm font-extrabold">Products &amp; Product IDs</h4>
          <span className="text-xs text-white/50">{data.items.length} items</span>
          <label className="ml-auto flex min-w-[180px] flex-1 items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2 sm:flex-none"><Search className="h-4 w-4 opacity-60" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product or ID" className="w-full bg-transparent text-xs outline-none" /></label>
          <Copy1 text={JSON.stringify(data.items, null, 2)} label="Copy all (JSON)" />
        </div>
        <ul className="mt-4 divide-y divide-white/10">
          {items.length === 0 && <li className="py-6 text-center text-xs text-white/50">No products found.</li>}
          {items.map((i) => (
            <li key={i.product_id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3">
              <button type="button" onClick={() => navigator.clipboard?.writeText(String(i.product_id)).catch(() => {})} title="Copy Product ID" className="shrink-0 rounded-lg bg-violet-500/20 px-2.5 py-1 font-mono text-xs font-bold text-violet-200 cursor-pointer">{i.product_id}</button>
              <div className="min-w-0 flex-1 basis-40"><p className="truncate text-sm font-bold">{i.product}</p><p className="text-xs text-white/60">{i.duration} · {i.category}</p><p className="text-[10px] text-white/40">Style 1: product_id {i.group_id} + duration "{i.duration}"</p></div>
              <span className="text-sm font-extrabold">₹{i.price}</span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${i.status === "MAINTENANCE" ? "bg-amber-500/20 text-amber-300" : i.in_stock ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>{i.status === "MAINTENANCE" ? "Maintenance" : i.in_stock ? (i.stock != null ? `${i.stock} in stock` : "Available") : "Out of stock"}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
