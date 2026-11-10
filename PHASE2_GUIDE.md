# Phase 2 – API SYSTEM (plain steps)

## 1. Put the code live
1. Copy these files over your project (same as last time), then `git add . && git commit -m "phase 2" && git push`.
2. Wait for Vercel to finish ("Ready").

## 2. Run the SQL (once each, in Supabase -> SQL Editor). Take a backup first.
Run in this order, only the ones you have not run yet:
1. `supabase/tenant/004_CUSTOM_DOMAINS.sql`
2. `supabase/tenant/005_SUBSCRIPTIONS.sql`
3. `supabase/tenant/006_API_SYSTEM.sql`
Each is additive (adds, never deletes) and safe to run twice. Rollback files exist (`00x_ROLLBACK.sql`).

## 3. Set up each store that will use JPRIME API stock (Admin -> Co-admins)
1. Press **Set wallet user** on the store and type the reseller username (on YOUR main store) whose wallet pays for it.
2. Switch **Shared stock** on for that store.
That wallet pays your reseller price for every JPRIME API sale. If it runs low, the customer sees: "Out of stock. The store admin's credit is low, please contact the admin."

## 4. What you (owner) see – Admin -> API System
- Two cards: **bb team admin** (Seller 1) and **whitex seller hub** (Seller 2) with how many stores use each.
- A list of store requests with: **Approve** (pick one of the two sellers), **I will build it**, **Reject**.

## 5. What a co-admin sees – Admin -> API System
- JPRIME API stock card (their wallet balance and whether it is enabled).
- **Add your own API**: 1) my own API, or 2) another seller's API. They fill API key, master key (if any), endpoint URL, a big box for the API code/docs, and the seller name (option 2).
- After you approve, the card lets them add/change their own keys, and the seller appears in **Add Product -> Supplier**.
- JPRIME API stock in Add Product: choose your product + duration; the Product ID locks to yours; the selling price cannot be lower than your cost. Blank video/features = JPRIME's are copied in.

## 6. Branding
Branding tab now has "Login page character picture link" and "pet picture link" (https link to a transparent PNG; nothing is uploaded to Supabase).

## 7. Test it (10 minutes)
1. Co-admin: API System -> Add your own API -> send.
2. Owner: API System -> Approve with bb team admin.
3. Co-admin: add the key, then Add Product -> Supplier shows "bb team admin (my own key)".
4. Owner: set wallet user + Shared stock on; add wallet money to that user.
5. Co-admin: Add Product -> JPRIME API stock -> pick product/duration -> price above cost -> save. Buy it as a customer.

## Honest limits
- I could not click through two real stores on real Supabase; automated tests (164) use a simulated database plus real Postgres for SQL 004/005/006.
- Customers see "out of stock / credit low" when they try to buy, not as a label on the product card.
- The price floor is checked when the product is saved; a coupon/discount could still push a sale below your cost.
- Vercel Hobby is for non-commercial use and allows 50 domains; selling subscriptions may need Vercel Pro (and Supabase Pro later).
- Old order history is matched by username, so a deleted username re-registered would see the old history.
