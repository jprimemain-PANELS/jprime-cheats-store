# JPRIME CHEATS STORE — Security audit & fix report

**Status: NOT yet verified production-ready.** Code compiles and builds, but nothing has been run against your real Supabase/gateway/suppliers. Follow the deployment checklist and run the security tests below before taking real money.

## What was actually checked
| Check | Result |
|---|---|
| `tsc --noEmit` | Ran. Original project: 25 errors. Fixed project: 21 errors, **all in code I did not touch** (login shader animation, Cashfree typings). No new errors. |
| `next build` | Ran with dummy env values. Compiled and generated all pages **only after temporarily stubbing the Google-Fonts import** (my sandbox cannot reach Google). On Vercel the fonts load normally. |
| ESLint | Not run (the project has no lint script/config). |
| Runtime / integration tests | **Not run.** I have no access to your Supabase, payment gateway or suppliers. |

## Missing information (could not see; handled defensively)
Database schema, RLS policies and grants; the SQL function `process_payment_and_release_key` (is it SECURITY DEFINER? who can call it?); `users.password` column length; whether `payment_orders` has a `utr` column; `wallet_transactions.type` check constraint; whether `wallets.username` is unique. Run STEP 0 of the SQL file and send me the output if you want a schema-aware review.

## Critical vulnerabilities found (original code) and the fix
| # | Vulnerability | Files | Fix |
|---|---|---|---|
| 1 | **No real authentication.** Login = anon-key SELECT of `users` with the plaintext password; "logged in" = a localStorage JSON anyone can edit. | `app/login/page.tsx`, `app/auth/*`, `components/auth-buttons.tsx`, `app/page.tsx` | New server login with scrypt hashing (old plaintext passwords upgrade automatically on next login), HttpOnly+Secure+SameSite cookie session, rate limiting, same-origin check. |
| 2 | **Anyone could pretend to be any user / admin.** Admin APIs trusted an `x-admin-email` header; admin page trusted localStorage. | `app/api/admin/*`, `app/admin/page.tsx`, `components/admin/*` | `requireAdmin()` verifies the signed session and re-reads the role from the DB on every call. |
| 3 | **Wallet theft/free items.** `get-wallet` returned (and created) any user's wallet; `pay-via-wallet` trusted client price/username, read-then-write balance (double-spend), delivered the key before charging; the browser could read/write `wallets` directly. | `get-wallet`, `pay-via-wallet`, `wallet-history`, DB grants | Own wallet only; server-side price; atomic compare-and-swap debit **before** delivery; refund if delivery fails; ledger entries. |
| 4 | **Price manipulation.** Client-sent `amount` was used to create UPI/wallet orders. | `create-upi-order`, `pay-via-wallet` | Price computed server-side (catalog → price override → VIP/reseller), mirrors the storefront. |
| 5 | **UPI replay / cross-user.** Anyone could verify/read any order; the same UTR could settle many orders; wallet top-up credit was read-then-write (double credit). | `verify-payment`, `verify-wallet-payment`, `get-payment-order` | Orders bound to the session user; only `pending` orders can be claimed (atomic); UTR replay check (+ unique index in SQL); atomic claim before credit. |
| 6 | **Unauthenticated key dispensers / supplier spending.** `get-key`, `save-purchase`, `reseller-buy`, `reseller-buy-seller2`; hard-coded fallback master key in `reseller-buy`. | those routes | Retired (HTTP 410). **Rotate the Seller 1 master key — it was in your source code/zip.** |
| 7 | **Public purchase history of ALL customers (with keys).** | `get-purchases` | Returns only the caller's own purchases. |
| 8 | **Unauthenticated payment webhook** could trigger the key-release RPC. | `payment-webhook` | Requires `x-webhook-secret` = `PAYMENT_WEBHOOK_SECRET`. Fails closed if unset. |
| 9 | **Supplier IDs shipped to every browser** (storefront/admin imported `lib/products.ts`). | `lib/useCatalogProducts.ts`, `app/admin/page.tsx`, `ProductManager.tsx` | Client no longer imports it; `/api/catalog` falls back to a supplier-stripped list; admin gets the raw list only from an admin endpoint. |
| 10 | Admin panel wrote directly to DB tables from the browser with the anon key (stock keys, prices, user roles, wallet balances). | `app/admin/page.tsx`, `ProductManager.tsx` | New `/api/admin/data` (admin session required). |
| 11 | Sensitive data in logs/messages: full supplier responses (contain keys), raw DB errors returned to clients, key posted in Telegram wallet message, unescaped HTML in Telegram. | `release-product.ts`, many routes, `telegram.ts` | Removed/redacted; generic errors; no key in Telegram; HTML-escaped. |
| 12 | Unauthenticated `test-telegram`; `users` table (with passwords) readable by anon key. | `test-telegram`, DB | Admin-only; SQL STEP 2 locks tables. |
| 13 | `typescript.ignoreBuildErrors: true` hides type errors. | `next.config.mjs` | Left as is (turning it on would fail your build because of the 21 existing errors). Security headers added. |

## Preserved
No tables created or dropped; no data deleted/reset; wallets, purchase history, catalog, admin workflow, two-supplier routing (`lib/release-product.ts` logic unchanged), Telegram notifications and all existing env var names kept. Storefront look unchanged.

## Behaviour changes you should know about
1. Everyone must log in once more (sessions are new). Existing passwords keep working and are upgraded to hashes automatically.
2. Wallet Telegram message no longer includes the key (the UPI one never did).
3. Legacy Cashfree pages (`/shop`, `/test-buy`, `/payment-success`) now redirect to `/`; `/auth/login` and `/auth/signup` redirect to `/login`.
4. Wallet top-up limited to ₹1–₹50,000 per order.
5. The MacroDroid webhook needs the new header `x-webhook-secret`.
6. Wallet purchases are charged first, then delivered; if delivery fails the amount is refunded automatically and logged as `refund` in `wallet_transactions` (if your table has a CHECK constraint on `type`, add `purchase` and `refund` — see below).

## Environment variable NAMES
Existing (unchanged): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FP_API_KEY`, `RESELLER_API_KEY`, `RESELLER_MASTER_KEY`, `SELLER2_API_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
**New — required:** `SESSION_SECRET` (random, ≥32 characters; generate with `openssl rand -base64 48`).
**New — only if you still use MacroDroid:** `PAYMENT_WEBHOOK_SECRET` (random, ≥16 characters; add header `x-webhook-secret` in MacroDroid).

## Known limits (be honest with yourself)
- Rate limiting and the "purchase in progress" lock are in-memory (per serverless instance). The real double-spend protection is the database compare-and-swap, which is instance-independent.
- If the server crashes between "wallet debited" and "key delivered", the ledger row `purchase` exists without a purchase_history row — recoverable by support, but not automatically.
- Wallet top-up claim uses status `success` as the atomic claim and releases it back to `pending` if crediting fails (the `deposit_history.status` column may not accept a separate `processing` value).
- Sessions are stateless: logout clears the cookie; a stolen cookie stays valid until expiry (7 days) or the user's password changes. Changing the password revokes all sessions.
- No CSP header yet (risk of breaking your UI without testing).
- Supplier "success but no key" cases are still logged with the supplier response (needed to recover paid keys) — protect your Vercel logs.

## Deployment checklist
1. Back up the Supabase database and the current project.
2. Add `SESSION_SECRET` (and `PAYMENT_WEBHOOK_SECRET` if used) in Vercel → Environment Variables.
3. **Rotate** the Seller 1 master key and any key that was ever in the old source.
4. Copy the files from this ZIP over your project (same paths). Do not delete anything else.
5. Run SQL **STEP 0** (read-only) and, if you want replay protection, **STEP 1**. Check `wallet_transactions.type` constraint accepts `purchase`/`refund` (if there is one, extend it).
6. Deploy to a Vercel **preview** first. Test everything below.
7. Only after all tests pass on preview/production, run SQL **STEP 2** (locks anon access) and re-test login, wallet, UPI, admin.
8. Then: test product delivery with a ₹1 product, add the remaining products, go live.

## Security tests (run on preview with test accounts)
1. **Other user's wallet:** log in as A; `POST /api/get-wallet` body `{"username":"B"}` → must return A's balance only. `GET /api/wallet-history?username=B` → A's rows only. Logged out → 401.
2. **Forged admin header:** as a normal user or logged out, `curl -H "x-admin-email: <admin email>" /api/admin/catalog` → 401/403. Same for `/api/admin/data`, `/api/admin/reseller-prices`.
3. **Price manipulation:** `POST /api/pay-via-wallet` / `create-upi-order` with `{"amount":1,"price":1}` extra fields → charged the real price; created order amount equals real price.
4. **Concurrent spend:** wallet with exactly one product's price; fire 10 parallel `pay-via-wallet` calls → exactly one succeeds, one key, balance 0.
5. **Payment replay:** verify a paid UPI order, then call verify again → returns the same key, no second supplier purchase. Use the same UTR on a second order → `duplicate_utr`. Verify someone else's `gateway_order_id` → 404.
6. **Wallet top-up replay:** submit the same UTR twice / concurrently → credited once.
7. **Role tampering:** edit localStorage `role` to `admin` → admin page still redirects; `/api/admin/*` still 403.
8. **Webhook:** POST without `x-webhook-secret` → 401.
9. **Supplier leakage:** view-source / Network tab on `/` and `/api/catalog` → no `seller`, `variant`, `pid` fields.
10. **Anon key (after SQL STEP 2):** with the anon key, `select * from users` via the Supabase REST API → permission denied.
