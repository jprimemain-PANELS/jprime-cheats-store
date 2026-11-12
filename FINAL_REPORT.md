# Final report (v10 + v11)

## Completed features
v10: tutorial video box (owner + co-admin, ON/OFF); ID column in Users; locked wallet account (no change, masked password); co-admin reseller launch toggle per store (+ verified main account); upgrade price/ON-OFF settings; mobile header + long brand names; delete-store frees the reseller to relaunch; Ban/Unban with "This website is banned by the admin" page.
v11: branding live preview; Profile page (role, wallet, purchases, total spent, change password); custom product categories (owner + co-admin); customer -> reseller upgrade; owner maintenance no longer stops co-admin JPRIME delivery; owner-deleted products vanish from co-admin stores; wallet close (X) button fixed; Branding crash fixed; Geist font restored.

## New / changed files (main)
New: lib/store-options.ts, lib/categories.ts, lib/upgrade-reseller.ts, app/api/admin/store-options/route.ts, app/api/upgrade-reseller/route.ts, app/profile/page.tsx, components/store-banned.tsx, components/admin/StoreOptionsCard.tsx, components/admin/LivePreview.tsx, supabase/tenant/007_BAN_AND_OPTIONS.sql (+ROLLBACK), tests (v10-options, v11-sync, upgrade-reseller, categories, hooks-order), SECURITY_REPORT.md, MAINTENANCE_DESIGN.md.
Changed: app/layout.tsx, app/page.tsx, app/login/page.tsx, app/launch/page.tsx, app/admin/page.tsx, app/api/catalog/route.ts, app/api/tenant/apply/route.ts, app/api/admin/tenants/route.ts, lib/{tenant,subscription,domains,tenant-admin,api-system,brand,products,catalog-edit}.ts, components/{navbar,auth-buttons,wallet-modal,product-card}.tsx, components/admin/{BrandingManager,CoAdminManager,SubscriptionManager,ProductManager,bulk-controls}.tsx, next.config.mjs, .gitignore.

## Database migrations
Only `007_BAN_AND_OPTIONS.sql` (adds `tenants.banned`). Run after a backup. Rollback: `007_ROLLBACK.sql`. (004/005/006 from earlier versions if not yet run.)

## Tests / build
tsc clean; vitest all passing (see last run); test:logic 51 passing; scratch production build OK; phone-width browser check of admin tabs without errors.

## Security fixed / remaining
See SECURITY_REPORT.md.

## Not completed
- Dedicated beginner/mobile redesign of every co-admin page (layout already works at phone width; a deeper simplification is still open).
- Maintenance mode: design only (as requested).
- Next.js upgrade, CSP, persistent rate limiting: recommended, not done (risk of breaking the live site).

## Git commands (run on your PC inside the project)
git checkout -b v11-update
git add -A
git status            # check no .env / secrets are listed
git commit -m "v10+v11: store options, bans, profile, categories, upgrade, security notes"
git push origin v11-update      # then test on the Vercel Preview URL; merge to main only after it works
