# v17 — 7 whole-site designs, new Guild Glory card, Guild for co-admins

## Designs (Admin → Co-admins → "Store design" / "Main website design")
Classic (default, unchanged) + 7 designs: Folio, Neon Core, Olive Editorial, Float Glass, **Arena** (new), **Console** (new), **Retrowave** (new). Pixel 95 is removed (a store that had it falls back to Classic).
* A design now changes the WHOLE site: home, login, profile, QR/payment page, wallet window, terms/privacy/contact pages, loading spinners, footer, scrollbars.
* **Branding is connected**: the design has its own colours, but if the store admin saves their own colours / font / corner style / card style in Branding, those are used inside the design.
* Mobile layouts were rebuilt and checked at 360 / 390 px wide on every page (no sideways scrolling).

## Guild Glory card
New "Vault" look: header with credit pill, three tabs (Tokens / Launch / Guilds), token pack tiles, ticket-style token, region chips, vertical launch timeline, and a guild "control deck" (glory number, goal ring, icon actions). It uses the store colours, so it matches every design.

## Guild Glory for co-admin stores
Each co-admin connects THEIR OWN seller account: Admin → **Guild Glory** tab → paste the seller API key. Then Products → **Add Guild Glory**. The key is never shown again (last 4 characters only) and the owner's key is never used for a co-admin store. Requires `GUILD_API_URL` in Vercel (already set).

## Install
Unzip OVER the project (delete the old `app/api/guild/order` folder if it still exists). No new SQL. No new env variables.
