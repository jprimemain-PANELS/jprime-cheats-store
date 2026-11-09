# Co-admin stores: setup guide (read in this order)

## 1. Database (Supabase SQL editor, in this order — never skip the backup)
1. `supabase/tenant/000_PRECHECK_READ_ONLY.sql` (read-only; fix the reported duplicate usernames first)
2. Make a Supabase backup.
3. `001_TENANT_FOUNDATION.sql`  (rollback: `001_ROLLBACK.sql`)
4. `003_COADMIN_FUNCTIONS.sql`  (rollback: `003_ROLLBACK.sql`, drops only helper functions)
5. Deploy the new code to a Vercel **Preview** first and test the owner store.
6. `002_CONTRACT_AFTER_CODE_DEPLOY.sql` only after the code is live and before the first co-admin is approved.

## 2. Free neutral subdomains (you must own the parent domain)
1. Buy/pick a neutral domain, e.g. `shopnet.example` (no "JPRIME" in it).
2. DNS: add a wildcard record `*.shopnet.example` pointing to Vercel (CNAME `cname.vercel-dns.com`).
3. Vercel → Project → Domains → add `*.shopnet.example` (wildcard needs Vercel nameservers or the DNS record Vercel shows).
4. Vercel env var: `PLATFORM_ROOT_DOMAIN=shopnet.example` (then redeploy).
5. When you approve an application, the store gets `slug.shopnet.example` automatically.
Without step 4 approvals still work but no address is created (the admin tab warns you).

## 3. Flow
- Reseller logs in → "Launch Your Own Website" → application (pending, nothing goes live).
- Owner admin → **Co-admins** tab → Approve / Reject / Suspend / Reactivate, or "New store" to create one directly.
- Co-admin signs in on their own address with the admin username/password they chose → their own admin panel (their users, products, pricing, **Branding**).

## 4. Not built yet (be aware before onboarding real sellers)
- Per-store payment gateway (co-admin stores return "Payments are not configured" — they cannot take deposits yet).
- Co-admin own seller API (URL/key/master key) and JPRIME shared-stock with prepaid platform wallet.
- Per-store Telegram notifications (skipped for co-admin stores).
- The UPI payment page keeps its original colors.
