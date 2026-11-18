# v15f – Guild name fix + seller's group options
- Fix: guild name disappeared because each refresh re-matched the group by Guild ID + region; launching the same Guild ID twice (or a region/case mismatch) broke the match. Now each group is paired ONCE with the seller's real group id (by creation time) and saved; the guild name is saved too, so it stays even if the seller is slow.
- Groups not on the seller's list for 10+ minutes show "ENDED" (no controls). Not auto-refunded; the customer can press Request Refund.
- Buttons like the seller's page: Restart, Stop, Refresh (seller refresh-all), Match History, Copy ID, Request Refund, Delete Group, Players Info. Plus Accounts, Uptime, Last match, Clan ID, Weekly glory.
- Request Refund: the seller API has no refund call, so it records "guild.refund_requested" in the audit log for you to review and refund manually (once per group). Nothing is refunded automatically.
- Delete Group: stops it, hides it at the seller, removes it from the customer's list.
- Match history / players: the seller's reply format is unknown, so each row shows the plain fields it sends (secrets and nested data are dropped).
- Remember: delete the old `app/api/guild/order` folder if present. No SQL changes.
