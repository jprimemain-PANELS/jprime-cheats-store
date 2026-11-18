# v15c – what changed

1. **Maintenance products go to the bottom.** ONLINE products show first, MAINTENANCE last (live status is read from the same switch you use in admin).
2. **Feature list shows 4 lines**, the rest open with the small down arrow ("Show N more").
3. **Guild Glory bot product** (category "others"), owner store only.
   - Admin → Products → amber **Add Guild Glory** button → set prices/features → Save.
   - Customer sees: Account region, Guild/Clan ID, Payment "wallet balance", **Launch Group**.
   - Wallet is charged first; if the seller API fails the money is refunded automatically.

## You must set (Vercel → Environment Variables), then redeploy
- `GUILD_API_URL` = the seller's start-order URL (https)
- `GUILD_API_KEY` = the API key the seller gave you

## IMPORTANT caveat
I have not seen the seller's real API docs. `lib/guild-glory.ts → startGuildBot()` assumes:
POST `GUILD_API_URL`, `Authorization: Bearer <key>`, JSON `{guild_id, region, duration, reference}`,
reply `{ok:true, order_id}`. If the seller's format differs, only that one function needs changing.
Send me the seller's tester zip / README and I will match it exactly.
(testing / test_key1234 is for the seller's local Termux tester only – do not use it in the shop.)

Regions list is editable in `lib/guild-glory.ts` (`GUILD_REGIONS`).
No SQL changes in this version.
