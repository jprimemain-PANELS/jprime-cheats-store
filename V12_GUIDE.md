# v12 (includes v11b) - what changed

1. **JPRIME cost now follows the payer's own price** (important). Cost = what the linked main-site account pays for that product:
   customer = retail, reseller = reseller price, VIP = the personal price you set in VIP Prices (e.g. 23). The "your cost" line in the
   co-admin product form and the real wallet charge both use the same number. Another VIP's price is never used.
2. **Instant UPI product payment removed.** The "Instant UPI Payment" button is gone from products and the server refuses new
   direct-UPI orders (HTTP 410). Wallet top-up by UPI still works; customers buy from the wallet, where a failed delivery auto-refunds.
   Orders already paid earlier can still be verified (verify route untouched). Telegram etc. unchanged.
3. **Wallet window**: one close X now on every wallet screen (home, Add money, history, QR); QR screen's left button is a Back arrow.
4. **Co-admin tab names are back to the original simple names** (Overview, Inventory, Pricing, Status, Products, VIP Prices, API System,
   Payments, Telegram, Branding, Domain, Subscription, Purchases, Users). The easy order is kept.
5. **Welcome steps card**: X button hides it for this login; it comes back at the next login (new session) and disappears for good
   5 days after the co-admin first opened it (clock is kept on the server, so another device cannot restart it).
6. **Paytm** (see below): Payments tab > "Check an order" now also shows which provider account the key belongs to and warns on a mixed-up key;
   new "Credit if paid" button credits a stuck top-up only if the provider says PAID (same safe database function, cannot double-credit).
7. **Ledger (both admins)**: search (product/key/order id), Today/7 days/30 days, days grouped with sticky date, totals for what is on screen,
   "Not credited" top-ups listed with Order ID + "Credit if paid", balance check banner, role/joined/last purchase, copy key/order id,
   print, reload, show-more paging, CSV now includes key + order id.
8. Branding crash fix, profile page, categories etc. from v11a/v11b are included.

## About Paytm "Waiting for your payment"
I checked the code against the provider's public API page: create = GET autoqr.php?api_key&amount, verify = GET autoverify.php?api_key&order_id,
status read from data.status (PAID/PENDING/EXPIRED). The website does exactly that. "PENDING" means the provider answered PENDING.
Two things on our side that can cause it: (a) the key saved in the PAYTM slot is not the Paytm key (the money then goes to another account) - the
Check button now shows the provider account name and warns; (b) nothing else was found. If Check shows "provider account: PAYTM" and still PENDING
while Anuj's test shows PAID, send me the exact two JSON answers (Check > raw) and his screenshot text so I can compare field by field.

## Not changed / notes
- No new SQL in this version (007 from v10 only for Ban).
- "Router action dispatched before initialization" in your terminal is a Next.js development-mode message; production build shows none.
