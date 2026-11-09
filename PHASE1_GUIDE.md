# PHASE 1: what is new, and how to switch it on (in order)

## WHAT YOU GET IN PHASE 1
1. Seller names changed everywhere in your admin: Seller 1 = "bb team admin", Seller 2 = "whitex seller hub" (only the names shown; nothing inside purchases changed).
2. Co-admin "Add Product": they only get "Local Stock" (their own keys). "JPRIME API stock (coming soon)" is shown greyed out. The server also refuses any other supplier for co-admin stores.
3. "Import Existing" is HIDDEN for co-admins. (It copies YOUR built-in product list, which is not for them.) Your own admin still has it.
4. Launch WITHOUT your approval: reseller presses "Launch Your Own Website", fills a simple form, chooses
   - Free address (example rajstore.jprimecheats.store) or
   - My own domain (example shop.rajstore.com; DNS steps are shown after launch, domain turns on automatically if you did the Vercel token step),
   and gets the website link at once. One store per reseller.
5. The launch button now shows on MOBILE ("Launch Website").
6. Subscription: 3 days free trial (first time only), then Weekly Rs 90 / Monthly Rs 249 / 3 Months Rs 695 (7% off). Paid from the reseller's wallet on YOUR main website, no new payment page. New days are added after the current days.
   When the plan ends the store becomes "suspended" (customers see it, cannot buy) until renewed. Stores that already exist (test2, Adam cheats...) have NO expiry and are not affected.
7. Co-admin admin page has a new "Subscription" tab: wallet balance, days left, pay buttons.
8. Your Co-admins tab shows each store's plan end date and the wallet it is paid from.
9. XYZ gateway card is hidden in this version of your Payments tab.

## HOW TO SWITCH IT ON  (about 15 minutes)
STEP 1. Copy jprime-platform-v4.zip into your project (Replace), commit, push in Cursor. Wait until Vercel says Ready.
        Everything works as before. The new launch page keeps the OLD "apply and wait for approval" way until step 2 is done.
STEP 2. Supabase > SQL Editor. BACKUP FIRST (Database > Backups, or export). Then paste and Run:  supabase/tenant/005_SUBSCRIPTIONS.sql
        It only ADDS 4 empty columns and 2 functions. Undo: 005_ROLLBACK.sql.
        (For own-domain launch also run 004_CUSTOM_DOMAINS.sql if you have not yet.)
STEP 3. Test with a NEW reseller account (a reseller account on jprimecheats.store, on the LIVE site, not localhost):
        a) On a phone, log in -> see the "Launch Website" button -> press it.
        b) Fill the form with the free address -> Launch -> link appears -> open it -> log in with the admin username/password you typed.
        c) Admin -> Subscription: you should see 3 days left and the wallet balance.
        d) Put Rs 100 in that reseller's wallet (your admin) -> Subscription -> Weekly -> days go from 3 to 10, wallet goes down by 90.
STEP 4. Tell resellers.

## TRIAL DAYS
You wrote both "4 day" and "3 day". I used 3. To change: lib/subscription.ts -> TRIAL_DAYS = 4.

## PRICES
To change prices you must change BOTH lib/subscription.ts (what is shown) and 005_SUBSCRIPTIONS.sql (what is charged). A test checks they match.

## SUPABASE FREE SPACE (your worry)
- Phase 1 adds almost no data: 4 small columns, and 1 small log row per payment.
- Images (logos, banners, the login pet picture) will be saved as LINKS only, never uploaded into Supabase. Use Cloudinary, which you already use.
- To see what is using space: Supabase > SQL Editor > run supabase/tenant/000_SIZE_CHECK_READ_ONLY.sql (read-only) and send me the result. Usually the big ones are old logs/history tables, and I can give you a SAFE cleanup (with backup) in Phase 2.
- Free Supabase = 500 MB. If you pass it, the project turns read-only. Check the size now, and delete my_supabase_backup.sql style files from GitHub (they are not in Supabase, but they hold secrets).
- Selling co-admin plans is a paid service: Vercel Hobby is non-commercial and Supabase free has no backups/guarantees. When money comes in, upgrade Vercel Pro and Supabase Pro.

## PHASE 2 (next chat, in this order)
A. "API SYSTEM" tab: your two seller cards (bb team admin, whitex seller hub) + JPRIME API card for co-admins, "Add your own API" form (my own / other seller), your approve button, per-store seller cards.
B. Co-admin API wallet: product picker from your products (product id locked), "out of stock / admin credit is low" for their customers.
C. Co-admin's own payment gateway (ANUJ FamPay + PAYTM): add/edit own keys, per-store (today a co-admin store cannot take payments).
D. Telegram notifications per store.
E. Branding: login page character/pet image by link, and "add feature / video" hint for co-admin product form.
Until C is done, customers in a co-admin store cannot top up wallets, so announce Phase 1 as "early access".
