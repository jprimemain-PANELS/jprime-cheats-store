# v19 — Reseller API (new "API" tab for every reseller)

**What resellers see:** on the home page, an extra **API** tab (only for accounts with role *reseller*, on the main store and on every co-admin store). It has: generate / replace / turn-off key, the store base URL, copy-ready examples, and the list of products with **Product IDs**, their reseller price and stock.

**How it works:** the reseller's bot/website calls the store's own address. Money is taken from the reseller's wallet at the reseller (or VIP) price, the key comes from the store's stock / API sellers exactly like a normal purchase, and the sale appears in purchase history. A failed delivery refunds automatically. `idempotency_key` prevents double buys.

**No-code connect:** besides the standard JSON API there are three request styles (`/api/reseller/compat/s1|s2|s3`) that copy the request/response shapes of your three seller APIs, so a bot built for those only changes URL, key and product IDs.

**For you (owner):** nothing to configure. No SQL, no env vars. Share `RESELLER_API.md` with resellers who ask. The old Guild Glory partner guide is still `GUILD_PARTNER_API.md`.
Keys are stored hashed; Product IDs start at 1001 and are saved per store.
Delete old leftovers before deploying: `app/api/admin/guild-key`, `app/api/guild/order`.
