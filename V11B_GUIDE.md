# v11b (includes v11a) - what changed
- FIX: Branding tab crashed ("Rendered more hooks") - a hook was after an early return. Fixed, plus a test that fails if any component ever does this again.
- Customer -> Reseller upgrade: Profile page shows "Become a reseller" when the store switch (Branding > Store options) is ON. Price comes from the store settings (server side). Charges the customer's wallet once, promotes only plain customers, refunds automatically if anything fails.
- Owner maintenance no longer stops a co-admin's JPRIME key delivery (co-admin controls their own product status).
- Owner deletes a product -> co-admin copies disappear from the store (only the JPRIME durations the owner stopped selling); purchase history stays; own products are untouched.
- MAINTENANCE_DESIGN.md = idea only (not built).
- No new SQL (007 from v10 still needed for Ban).
- Checked in a real browser at phone width: Overview, Branding, Users, Products open without errors or sideways scrolling.
