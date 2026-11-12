# Security review - JPRIME platform (code-level, nothing deployed, no production SQL)

## Checked and already good
- **Server-trusted identity:** role/tenant come from the signed, HttpOnly session; browser values are ignored (`requireUser`, `requireTenantAdmin`, `requireAdmin`). Cross-origin POSTs blocked (`isSameOrigin`).
- **Tenant isolation:** every tenant table read/write goes through `tdb(tenantId)`; a test fails if any new file imports the service-role client without being allow-listed (`tests/static-guard.test.ts`).
- **Passwords:** hashed; reset shows a one-time random password; change password re-issues only the current browser's session.
- **Secrets:** the only `NEXT_PUBLIC_` variables are the Supabase URL and anon key (meant to be public). Service-role key, session secret, seller keys, webhook secret are server-only. No passwords/keys are logged.
- **Payments:** webhook needs a shared secret and compares it in constant time; old unsafe routes (`save-purchase`, `create-order`, `reseller-buy*`, `get-key`) return 410 Gone; wallet debit/credit are atomic database functions; refunds are once-only.
- **Rate limits** on login, signup, forgot-password, change-password, wallet-link, upgrade, store-options.
- **XSS:** only 6 `dangerouslySetInnerHTML` uses, all for CSS/keyframes built by us (theme values are validated hex/choices), none render user text. Brand/product/category text is rendered by React (escaped). New categories are reduced to `a-z 0-9 -`.
- **Headers:** nosniff, X-Frame-Options (SAMEORIGIN since v11 for the preview), Referrer-Policy, HSTS, Permissions-Policy.
- **New in v10/v11:** launch from a co-admin store needs the owner's switch AND the main-site password (cannot charge a stranger); wallet link locks after the first link; ban/unban/reseller-launch are owner-only; upgrade price is read on the server; `.gitignore` now ignores `.env` and `.env.*`.

## Remaining risks (not changed, because changing them can break the live site)
1. **Next.js 16.2.6 has an audit finding rated critical (fixed in 16.4.6).** Upgrade on a Vercel *Preview* branch first, test login/payment/admin, then merge. Also `zod` (high, needs a major upgrade; only memory-exhaustion on huge input) and indirect `postcss/sharp/browserslist` (fixed by the Next upgrade / `npm audit fix`).
2. **`typescript.ignoreBuildErrors: true`** in `next.config.mjs` hides type errors at deploy. `tsc` is clean today, so you can set it to `false` on a Preview first.
3. **Rate limiting is in memory per serverless instance** - it slows guessing but a determined attacker spreading over instances can exceed it. Best fix later: Upstash/Redis or a Supabase table counter (free tiers exist) and Cloudflare rate-limit rules on `/api/auth/*`.
4. **No Content-Security-Policy.** Add as *Report-Only* first (payment gateway, YouTube and image hosts need allowing), then enforce.
5. **Telegram bot token** (you already know) should be revoked/rotated and moved to env only; also remove old backup files from GitHub.
6. **Git history secret scan** must be run on your machine (I have no repo access). Commands (they print file names only, not values):
   `git log --all --pretty=format: --name-only | sort -u | grep -Ei "\.env|backup|\.sql|\.pem|key"`
   `git log --all -S"service_role" --oneline`  and  `git log --all -S"SESSION_SECRET" --oneline`
   If anything real shows up: rotate that key in Supabase/Vercel, then clean history.
7. **Hobby plan / supabase free:** keep RLS on for all tables as you have it; never use the service-role key in client code (verified: only `lib/supabase-admin.ts`).
8. Forgot-password is a note to the admin (no email), so account recovery depends on the admin verifying identity - keep verifying by Telegram.

## What you should do (in order)
1. Rotate Telegram token. 2. Run the git-history commands above. 3. Upgrade Next on a Preview branch. 4. Add Cloudflare rate-limit rules on login/signup. 5. Later: CSP report-only.
