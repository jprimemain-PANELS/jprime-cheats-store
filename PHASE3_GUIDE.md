# Update v6 – what changed and what to do

## Do this (3 steps)
1. Copy the files over your project, then `git add . && git commit -m "v6" && git push`. Wait for Vercel "Ready".
2. In Supabase -> SQL Editor run the files you have NOT run yet, in this order: `004_CUSTOM_DOMAINS.sql`, `005_SUBSCRIPTIONS.sql`, `006_API_SYSTEM.sql` (all in `supabase/tenant/`). No new SQL file in v6.
   - "My own domain" on the launch page is greyed out until 004 is run. After 004 it becomes selectable.
3. For each existing store (test2, etc.): the store admin opens **Subscription** and presses **Connect** with their main-website username + password. Nothing for you to type. New stores launched from the website connect automatically.

## Wallet and JPRIME API stock
- Co-admin -> Subscription: "Your reseller account **andrews** wallet balance ₹1000".
- JPRIME API stock works automatically once the account is connected. No request, no "Shared stock" switch needed.
- Your price is taken from that wallet for each sale. The store sets its OWN selling price (no minimum).
- Your "Set wallet user" button still exists, but it only accepts a reseller account on the main store (not a store admin like test2).

## Product form for co-admins
- The duration box was empty because of a bug. Fixed.
- Delivery now says just "API". Seller names (bb team admin / whitex seller hub) are never shown, except after you approve a store for one.
- JPRIME product list shows your API-delivered products (including old ones without a saved supplier). Products delivered from LOCAL keys are not listed, because JPRIME stock means API stock.

## Passwords
- **Change password**: key button in the site header (everyone) and in the admin header.
- **Forgot password**: link on the login page. It sends a request to the store admin; the Users tab then shows a "forgot password" tag.
- **Reset password**: Users tab -> Reset password. A new random password is shown ONCE; send it to the user. Owner: Co-admins tab -> "Reset admin password" per store.
- Showing existing passwords is NOT possible: they are stored as one-way hashes (that is what keeps users safe if the database leaks). Reset-and-show-once is the safe replacement.

## Branding -> login page
- 5 login card designs: Glass Glow, Frost Light, Neon Outline, Clean Minimal, Aurora Border (+ Original).
- 5 animated backgrounds: Aurora Glow, Particle Network, Grid Beams, Silk Waves, Star Warp (+ Original).
- They use the store's own colors, so login and home page match. When a store picks a new design the default girl/pet is hidden unless the store sets its own picture links.
- Your owner login page is not changed.

## Honest limits
- I checked the card designs in a test page and the build/tests pass (170), but did not click through a live site.
- Forgot password needs a human (store admin) because the site has no email sending.
- If a store sells below your price, the store pays the difference from its wallet.
