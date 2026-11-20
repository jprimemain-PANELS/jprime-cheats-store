# Guild Glory Partner API — Integration Guide

Sell Guild Glory on **your own website** using our bots. You never need our seller panel or any server files: your website just sends requests to this API, and we run the bots.

- **You keep:** your own website, your own prices, your own customers and their wallets.
- **We charge you:** a fixed cost per group, taken from your **partner wallet** on our website (you top it up like any account).
- **Safe by design:** you can only see and control groups you created yourself.

---

## 1. Get started

1. Ask us for a **partner API key** (looks like `gp_` + 48 letters/numbers). Keep it secret. Use it only from your **server**, never in browser/app code.
2. Log in to our website with the partner account we gave you and **add money to the wallet**. Each new group costs `cost_per_group` (see `/account`).
3. Call the API from your backend.

**Base URL:** `https://jprimecheats.store/api/partner/guild`
**Header on every request:** `Authorization: Bearer gp_YOUR_KEY`
**Format:** JSON in, JSON out. Every response has `"success": true` or `"success": false` with an `"error"` message.

---

## 2. Typical flow on your website

1. Customer pays **you** on your site (your price, your payment method).
2. Your server calls **POST /groups** with the customer's region and Guild ID.
3. Save the returned `ref` with the customer's order.
4. Show live progress with **GET /groups/{ref}** (glory, members, status...).
5. Optional buttons for the customer: restart / stop / refresh / remove.

If the bot cannot start, **we return the wallet charge automatically** — also refund your customer.

---

## 3. Endpoints

### GET `/account` — your wallet and price
```json
{ "success": true, "balance": 540, "cost_per_group": 60 }
```

### GET `/regions` — available regions
```json
{ "success": true, "regions": [ { "id": "in", "name": "India", "code": "IN" } ] }
```
Use a region `id` when launching.

### POST `/groups` — start a group (charges your wallet)
Body:
```json
{ "region": "in", "clan_id": "3048506227" }
```
- `clan_id` = the numbers-only Guild / Clan ID.
- Optional header **`Idempotency-Key`** (8–64 chars: letters, numbers, `- _ . :`). Send a unique value per customer order (e.g. your order id). If your server retries after a timeout, you will **not** be charged twice; you get `"duplicate": true` with the same group.

Success `201`:
```json
{ "success": true, "group": { "ref": "G-abc123", "clan_id": "3048506227", "region": "in" }, "charged": 60, "balance": 480 }
```

### GET `/groups` — all your groups
```json
{ "success": true, "groups": [ { "ref": "G-abc123", "clan_id": "3048506227", "region": "in", "created_at": "2026-11-20T06:00:00Z", "name": "DHOLAKPUR", "status": "running" } ] }
```
`status` can be `starting`, `running`, `stopped`, `refunded`, `unknown`.

### GET `/groups/{ref}` — live details
Returns `{ "success": true, "group": { name, level, members, glory, bots, uptime, ... } }`.
- `?view=history` → recent match history rows
- `?view=players` → player rows
A brand-new group may answer `409 still starting` for a few seconds — just retry.

### POST `/groups/{ref}/actions` — control the bot
```json
{ "action": "restart" }
```
`action` is `restart`, `stop` or `refresh`.

### DELETE `/groups/{ref}` — stop and remove the group
```json
{ "success": true, "removed": true }
```

---

## 4. Errors

| HTTP | Meaning | What to do |
|---|---|---|
| 400 | Bad input (wrong region / Guild ID / action) | Fix the request, show the customer a message |
| 401 | Missing, wrong or disabled API key | Check the key |
| 402 | Partner wallet balance too low | Top up the wallet, then retry |
| 404 | Group not found (or not yours) | Check `ref` |
| 409 | Group still starting / another request in progress | Wait 3–5 s and retry |
| 429 | More than 90 requests per minute | Slow down |
| 502 / 503 | Service temporarily unavailable | Retry later. A failed launch is auto-refunded |

---

## 5. Code examples

### curl
```bash
curl -X POST https://jprimecheats.store/api/partner/guild/groups \
  -H "Authorization: Bearer gp_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-10042" \
  -d '{"region":"in","clan_id":"3048506227"}'
```

### Node.js (server)
```js
const BASE = "https://jprimecheats.store/api/partner/guild";
const KEY = process.env.GUILD_PARTNER_KEY; // never hard-code or expose

async function api(path, method = "GET", body, extra = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...extra },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, ...(await r.json()) };
}

// after your customer paid you:
const res = await api("/groups", "POST", { region: "in", clan_id: "3048506227" }, { "Idempotency-Key": "order-10042" });
if (res.success) console.log("Started", res.group.ref);
else console.log("Failed", res.status, res.error);
```

### PHP
```php
$ch = curl_init("https://jprimecheats.store/api/partner/guild/groups");
curl_setopt_array($ch, [
  CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ["Authorization: Bearer ".getenv("GUILD_PARTNER_KEY"), "Content-Type: application/json", "Idempotency-Key: order-10042"],
  CURLOPT_POSTFIELDS => json_encode(["region" => "in", "clan_id" => "3048506227"]),
]);
$data = json_decode(curl_exec($ch), true);
```

### Python
```python
import os, requests
H = {"Authorization": "Bearer " + os.environ["GUILD_PARTNER_KEY"], "Idempotency-Key": "order-10042"}
r = requests.post("https://jprimecheats.store/api/partner/guild/groups", headers=H,
                  json={"region": "in", "clan_id": "3048506227"})
print(r.status_code, r.json())
```

---

## 6. Good practice

- Call the API **only from your server**; never put the key in a web page or app.
- Always send an `Idempotency-Key` (your order id) when launching.
- Check `/account` balance before selling, and top up in time so customers are never blocked.
- If the key leaks, tell us immediately — we disable it and issue a new one.
