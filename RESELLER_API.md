# Reseller API — connect your own bot or website

Buy keys from this store automatically. Every purchase is paid from **your wallet on the store at your reseller price**.

## 1. Get your key
1. Log in to the store with your reseller account.
2. Open the **API** tab on the home page (next to Mobile / PC / iOS).
3. Press **Generate API key** and copy it (it is shown only once; if you lose it, create a new one).

The API tab also shows your wallet, every product with its **Product ID**, your price and live stock, and ready-to-copy examples.

**Base URL:** the store address, e.g. `https://yourstore.com/api/reseller/v1`
**Key header:** `Authorization: Bearer rk_...` (also accepted: `X-API-Key`, `X-API-Token`, or `api_key=` field)
**Limit:** 120 requests per minute. Call it from your **server / bot**, never from a public web page.

## 2. Standard JSON API
| Call | Meaning |
|---|---|
| `GET /balance` | `{success, balance}` your wallet |
| `GET /products` | all products: `product_id, product, duration, category, price, status, stock, in_stock` (`?category=mobile`, `?q=text`) |
| `GET /stock?product_id=1001` | `{in_stock, stock, status}` |
| `POST /buy` | `{"product_id":1001,"idempotency_key":"order-77"}` → `{success, key, order, price, balance}` |
| `GET /orders` | your recent API orders (with keys) |

Always send an **idempotency_key** (your own order id): if your server retries, you get the same key and are **not charged twice**.

Errors: `401` bad key · `402` wallet too low (top up on the website) · `404` unknown product_id · `409` out of stock / maintenance / busy · `429` too many requests · `502` delivery failed (you are **not** charged).

## 3. Already have a bot or panel made for another seller API? No code needed
Keep your bot. Change only **3 things**: the base URL, the key, and the product IDs (copy them from the API tab).

| Your bot expects | Use this URL | Request | Response |
|---|---|---|---|
| Style 1 (form + `api_key`, `action=buy`) | `/api/reseller/compat/s1` | `api_key, action=buy, product_id` | `{"status":"success","data":{"key":"..."}}` |
| Style 2 (`X-API-Token` header + `variant_id`) | `/api/reseller/compat/s2` | header `X-API-Token`, `variant_id, quantity=1` | `{"success":true,"keys":["..."]}` |
| Style 3 (Bearer + JSON `product_id`) | `/api/reseller/compat/s3` | JSON `{product_id, quantity:1, idempotency_key}` | `{"ok":true,"data":{"keys":["..."]}}` |

`product_id` / `variant_id` = the **Product ID** from the API tab. Extra actions in every style: `action=balance`, `action=products`, `action=stock&product_id=...`.
If your bot uses a different seller, tell the store owner which one so support can be added.

## 4. Examples
```bash
curl https://yourstore.com/api/reseller/v1/products -H "Authorization: Bearer rk_YOUR_KEY"

curl -X POST https://yourstore.com/api/reseller/v1/buy \
  -H "Authorization: Bearer rk_YOUR_KEY" -H "Content-Type: application/json" \
  -d '{"product_id":1001,"idempotency_key":"order-77"}'
```
```js
const r = await fetch("https://yourstore.com/api/reseller/v1/buy", { method: "POST",
  headers: { Authorization: "Bearer " + process.env.STORE_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ product_id: 1001, idempotency_key: "order-77" }) });
const { success, key, error } = await r.json();
```

## 5. Good practice
- Keep the key secret. If it leaks press **Create new key** (the old one stops at once) or **Turn off**.
- Check `in_stock` before selling and keep your wallet topped up.
- Product IDs never change for the same product + duration. If the owner renames a product, a new ID appears.
