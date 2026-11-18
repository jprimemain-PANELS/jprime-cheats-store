# v15b - editable plan prices, 2-way launch option, sub-stores, easier branding

## 1. SQL (backup first): run `supabase/tenant/009_PLAN_PRICES_AND_SUBSTORES.sql`
Safe to run twice. Rollback: `009_ROLLBACK.sql`. Until you run it, prices stay at the old fixed values (nothing breaks).
(Also run `008_SELLER3.sql` from v15a if you have not.)

## 2. Edit subscription price + free trial (your admin page)
Admin > Co-admin tab > top card "Main website: subscription prices & free trial". Change Weekly / Monthly / 3 Months price and Free trial days (1-30) > Save.
New launches and the next payment use the new prices. Stores already running keep their paid days.

## 3. "Co-admin reseller can launch website" button (each store in the Co-admin list)
Click it and choose:
1. Pay in my main website - the reseller pays YOU from their wallet on the main site (as before).
2. The co-admin's own website - the reseller pays the CO-ADMIN from their wallet on the co-admin's site. The co-admin's admin page automatically gets a "Sub-stores" page: edit their own prices + free trial, and see every sub-co-admin (name, link, reseller, days left).
Turn OFF is in the same dialog.

## 4. Easier Branding (owner + every co-admin)
- "Quick start: 3 easy steps": pick a look (17 themes with colour previews) > brand name + logo + tagline > banner words > Save.
- Logo, banner, background and login pictures: "Upload from gallery" (needs the same Cloudflare R2 setup as video upload; add CORS for PUT from your domains; or just paste a link).
- More: 4 new fonts, card hover effect (lift / glow), WhatsApp / Instagram / YouTube links in the footer, round chat button, "Not saved yet" marker and "Undo changes".
