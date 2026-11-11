# v10 - Part A (what is inside)

## Run this SQL once (after a Supabase backup)
`supabase/tenant/007_BAN_AND_OPTIONS.sql`  (adds one column: tenants.banned). Undo: `007_ROLLBACK.sql`.
Without it everything works EXCEPT the Ban button (it will tell you to run 007).
(Still pending from before: 004, 005, 006 if you have not run them.)

## New in Part A
1. **How-to-use video box** - Branding tab > "Store options": paste YouTube link + ON/OFF (owner and every co-admin). Login page shows it only when ON and the link is valid https. Your main site keeps its current video by default.
2. **ID column** in Users tab (both admins): "#1" = oldest account, bigger number = newer. Joined date under it.
3. **Subscription tab**: "Change account" removed. After linking, username and password boxes are locked. The password is shown as dots only: passwords are stored scrambled (hashed), nobody can read them back. The server also refuses a second link; only you can change it with "Set wallet user".
5. **Co-admin reseller can launch website**: per-store button in your Co-admins tab (OFF by default). When ON, that store's resellers see the Launch button and must type their MAIN website username + password (verified), so nobody can charge someone else's wallet.
6a. **Upgrade-to-reseller price + ON/OFF** is saved in Branding > Store options (default Rs 99). The actual "buy upgrade" button comes in Part B.
7. **Mobile header**: key/logout/launch buttons moved into the phone menu, so the wallet box is never hidden; long brand names are shortened with "..." instead of being cut.
9. **Delete store then relaunch**: deleting a store now also frees the reseller's one-store slot and the old name. **Ban / Unban** button on each store card; banned visitors see "This website is banned by the admin". Data is kept.

## Tests
tsc clean, 185 vitest (10 new), 51 logic, production build OK.

## Coming in Part B / C
Customer pays to become reseller; owner maintenance not stopping co-admin JPRIME delivery; owner deletes product -> disappears at co-admins; co-admin maintenance check; security audit report; maintenance-mode design notes (idea only, as you asked).
