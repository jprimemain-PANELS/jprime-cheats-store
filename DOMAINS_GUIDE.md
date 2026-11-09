# JPRIME CO-ADMIN: COMPLETE CHECKLIST (your DNS is on Cloudflare)
Do the steps in this order. Each step has a "how do I know it worked".

## STEP 1. Put the new code live  (about 5 min)
1. Unzip jprime-platform-v3.zip. Copy everything into your project folder, say "Replace" for existing files.
2. Commit and push to GitHub (same way as before). Vercel deploys by itself.
3. Worked? Vercel > Deployments shows "Ready" and https://jprimecheats.store still loads and you can log in.
   If the deployment shows Error, send me a screenshot of the build log.

## STEP 2. Free subdomains: Cloudflare records  (about 5 min)
In Cloudflare > jprimecheats.store > DNS > Records > Add record.
Record 1:  Type CNAME | Name *  | Target cname.vercel-dns.com | Proxy status: click the ORANGE cloud so it turns GREY ("DNS only") | Save
Record 2:  Type NS    | Name _acme-challenge | Name server ns1.vercel-dns.com | Save
Record 3:  Type NS    | Name _acme-challenge | Name server ns2.vercel-dns.com | Save
(If you can't find NS in the Type list: click the Type box and TYPE the letters "NS".)
Do not edit or delete any record that was already there.

## STEP 3. Vercel settings  (about 3 min)
1. Vercel > Project > Settings > Environment Variables > add  PLATFORM_ROOT_DOMAIN = jprimecheats.store  (Production). Save.
2. Settings > Domains: the row *.jprimecheats.store should already be there. Press Refresh. It can take up to an hour to go green.
3. Deployments > top one > ... > Redeploy (so the new variable is used).

## STEP 4. Test one free store  (about 5 min)
1. Log in as owner > Admin > Co-admins > "New store". Brand "Test", subdomain name "test1", fill username/password > Create.
2. Open https://test1.jprimecheats.store  -> a store named Test appears. Log in with the co-admin username/password.
3. Open Admin > Branding > press the "arcade" theme > Save > reload. The store must look very different from yours.
If test1 gives an error page (504/security warning), wait 30 minutes and retry. If still bad, send me a screenshot.

## STEP 5. Custom domain for BIG resellers: one-time setup  (about 10 min)
1. Supabase > SQL Editor > make a backup first > paste supabase/tenant/004_CUSTOM_DOMAINS.sql > Run.
2. Vercel > profile picture > Account Settings > Tokens > Create Token (name "domains") > COPY it.
3. Vercel > Project > Settings > General > copy "Project ID". If your project is under a team, also copy the Team ID (Team Settings > General).
4. Vercel > Project > Settings > Environment Variables (Production):
     VERCEL_TOKEN = (token)    VERCEL_PROJECT_ID = (id)    VERCEL_TEAM_ID = (only if team)
5. Redeploy. Keep the token secret.

## STEP 6. Give one big reseller their own domain  (each time)
YOU:  Admin > Co-admins > that store > press "Custom domain: off" so it says "allowed".
RESELLER: buys a domain (GoDaddy/Namecheap/Hostinger...), you can suggest shop.theirname.com.
RESELLER: store Admin > Domain tab > type the domain > "Get steps". Add the TXT and CNAME shown, at THEIR domain provider.
RESELLER: wait 5-30 minutes > press "Check DNS". When proof is found, the domain is added to Vercel and turned on automatically.

## STEP 7. Do these security jobs soon
- Telegram: @BotFather > /revoke > choose bot > put the new token in your store's Telegram setting.
- GitHub: delete my_supabase_backup.sql from the repo (it holds secrets), add *.sql to .gitignore, check if repo is Public.
  Change any other secret that was inside that backup (gmail app password, payment keys, seller API keys).

## BEFORE YOU ANNOUNCE TO RESELLERS (important, honest list)
WORKS NOW: separate store per co-admin (own users, products, prices, orders, wallets), own branding and layout,
           free subdomain, own domain, owner sees/controls every store, suspend/reactivate.
NOT BUILT YET: each store's own payment gateway (a co-admin store cannot take payments yet: deposits return "unavailable"),
           a co-admin's own seller API, JPRIME shared stock with prepaid wallet, per-store Telegram alerts,
           owner view of each store's platform wallet.
So a co-admin can only sell from stock they add themselves, and customers cannot top up wallets in their store until the payment part is built.
Hosting note: Vercel Hobby = 50 domains max and non-commercial use. Selling this to resellers is commercial; Vercel Pro is the paid fix.
