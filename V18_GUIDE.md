# v18 — 10 new whole-site designs

Owner dashboard → Co-admins → pick a design for any store. 18 designs total now (Classic + 7 from v17 + 10 new). Every design styles the WHOLE site (home, login, profile, QR payment, wallet dialog, legal pages, loaders, Guild card) and follows each store's Branding (colours / font / corners) when saved.

| Design | Home layout |
|---|---|
| Travel Freely | **Side slide-out menu** (hamburger opens a left drawer with categories, wallet, login) |
| Tidewell Ink | **Bottom floating menu dock** (categories, wallet, profile always at the bottom) |
| Lime Studio | ivory, black type, lime sphere, text nav |
| Midnight Studio | black, centred headline + menu, glowing arch |
| Blackridge | charcoal + red, light headline, dropdown-style nav, proof strip |
| Coral Tide | cream + coral, centred nav card, wave band |
| Mossgrove | green glass capsule nav, moss orb, glass tiles |
| Forest Serif | serif split layout with vertical category rail |
| Crimson Slide | black + red, giant slide number, numbered tabs |
| Serene Sand | thin serif, vertical numerals, calm text menu |

Reference photos (car, statue, ribbon, house) are replaced by CSS shapes/gradients so everything stays free and fast.
No SQL, no new env vars. Carry-overs still apply: SQL 008/009, GUILD_API_URL/GUILD_API_KEY, delete old `app/api/guild/order` folder.
