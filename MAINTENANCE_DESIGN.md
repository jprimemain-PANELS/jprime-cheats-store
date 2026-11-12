# Maintenance mode - design only (NOT built, as you asked)

**Goal:** a store (or the whole platform) can show a "Under maintenance" screen while admins still get in safely.

## Where the switch lives
- **Per store (co-admin or owner main store):** one value `maintenance = { on, message, until }` in that store's own settings (`app_settings` key `t:<tenantId>:maintenance`; owner keeps the raw key). Only that store's admin can change it, using the same `requireTenantAdmin` guard as other settings, so one co-admin can never touch another store.
- **Global (all stores):** one owner-only setting `platform_maintenance`, changeable only by `requireAdmin` (owner). Checked in addition to the store flag. Owner's own main store follows its own flag (global does not lock the owner out).

## Where it is enforced (server, not only the screen)
1. `app/layout.tsx` already resolves the tenant per request: if `global || store.maintenance.on` and the visitor is not an admin bypass, render a `StoreMaintenance` page (animated overlay) instead of the store.
2. Purchase and wallet APIs (`pay-via-wallet`, `create-upi-order`, `reseller-buy*`, `release-product`) refuse with 503 "under maintenance" using the same check, so nobody can buy by calling the API directly while the screen is shown.
3. Webhooks/payment verification stay ON so a payment made just before maintenance is still delivered.

## Admin bypass (without a public admin form)
- Do NOT put an admin login on the maintenance page.
- Admins already logged in keep working: the check skips visitors whose session role is admin/coadmin for THAT tenant (`user.tenantId === tenant.id`).
- A logged-out admin uses the normal `/login` URL (it stays reachable but is not linked or advertised on the maintenance screen); after login the bypass applies. Optionally rate-limit `/login` harder while maintenance is on.
- Customers/resellers who log in during maintenance still see the maintenance screen.

## Isolation rules
- Flag read by `tenant_id` only; a store flag never affects other stores; global flag is owner-only.
- Banned stores (v10) and maintenance are separate: banned = admin action, hard block; maintenance = temporary, store-owned.

## Product-level maintenance (already exists)
The Status tab (ONLINE/MAINTENANCE per product) is tenant-aware. v11b change: owner maintenance no longer stops a co-admin's JPRIME delivery.

## Effort
About one small column/setting, one layout branch, one shared `assertNotInMaintenance(tenant, user)` helper used by 5 purchase routes, one UI card in Branding. Roughly half a day, no new tables.
