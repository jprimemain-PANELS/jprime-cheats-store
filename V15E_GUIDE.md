# v15e – Guild live panel + launch animation (on top of v15d)
- **Delete the old folder `app/api/guild/order`** if it still exists in your project (leftover from v15c). Best: unzip into an empty folder.
- Launch button now shows steps: Checking region → Guild found → Bot players being added → Almost ready (visual timing while the seller answers; real errors still show in red).
- Below the form, "Your groups" shows up to 3 live group panels (name, level, members, captain, total glory, bots, uptime, 8h goal bar, status) refreshed every 20 s, with Restart / Stop / Refresh. Only the customer's own groups can be viewed or controlled.
- New route `app/api/guild/group` (GET info, POST restart|stop). Seller replies are cached 15 s so the seller's 60 requests/min limit is safe.
- Field names from the seller were not documented; the reader accepts common names and simply hides what is missing. If a field shows "–", logged in as admin open `/api/guild/group?ref=<group id>&raw=1` and send me that JSON.
- No SQL changes. Env unchanged: GUILD_API_URL, GUILD_API_KEY.
