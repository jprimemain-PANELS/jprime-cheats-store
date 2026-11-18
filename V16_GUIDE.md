# v16 – Five store designs (no SQL, no new env)

Admin (owner) → Co-admin stores:
- Each store card has a **Store design** dropdown. At the top there is **Main website design** for your own store.
- Customers see the change within about a minute. "Midnight Violet (current)" is the original look and the default; nothing changes until you pick another.

Designs (all different page layouts, same buying logic, wallet, Guild Glory card, footer and support button):
1. **Folio** – dark portfolio: giant headline, orange accent, numbered category list, sharp cards.
2. **Neon Core** – floating pill menu, glowing orb hero, neon glass cards.
3. **Pixel 95** – retro Windows-95 desktop: window with title bar, folder list, taskbar at the bottom (wallet, account, clock).
4. **Olive Editorial** – olive green magazine style: serif headline next to an arch, pill menu, "No. 01" labels on cards.
5. **Float Glass** – soft purple glass: dock on the left (bottom bar on phones), floating widgets, big rounded cards.

Notes
- The shop name, logo, tagline, hero title/subtitle/button text, contact links and Support button of each store are used in every design. Branding colours/presets apply to the Classic design; the other designs bring their own colours and fonts.
- Login page, admin pages and profile page are unchanged.
- The designs use only CSS animation (no heavy scripts), so Vercel CPU use stays low.
- Only the owner can change designs (co-admins cannot).
- New files: lib/store-designs.ts, components/designs/*. Changed: app/page.tsx, lib/store-options.ts, app/api/admin/tenants/route.ts, components/admin/CoAdminManager.tsx.
- Remember to delete the old folder `app/api/guild/order` if it is still in your project.
