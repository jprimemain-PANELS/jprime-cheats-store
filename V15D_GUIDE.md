# v15d – Guild Glory tokens + Clone product

## Vercel env (owner store) – then redeploy
- `GUILD_API_URL` = `https://automission.site`   (with or without /api/v1)
- `GUILD_API_KEY` = your key from the seller's Developer Center
(Old name `GUILD_API_URL` already used in v15c is the same; just set the new value.)

## How customers use it (all inside the Guild Glory product card)
1. **Buy tokens** – pick 1 / 2 / 5 / 10 tokens, paid from wallet. A token code `GG-XXXX-XXXX-XXXX-XXXX` appears with a Copy button.
2. **Redeem** – paste a token; credits appear in the small "Credits" box at the card's top-right corner. Tokens can be shared/gifted; each works once.
3. **Launch group** – choose region (live from the seller, only available ones) + Guild ID → spends 1 credit, calls the seller `POST /groups`. If the seller fails, the credit comes back. If the seller later marks the group failed/refunded, the credit returns once.

You pay the seller from your own seller wallet (the ~₹60/credit); customers pay you the price you set.

## Admin setup
- Products → **Add Guild Glory**. Plans are token packs: the plan name MUST start with the number (`1 Token`, `2 Tokens`, `5 Tokens`, `10 Tokens`). Set the price for each. Status ONLINE/MAINTENANCE works as usual.
- Customers' tokens/credits are hidden wallet rows and never appear as users.

## Clone product
Products list → **Clone** on any product: opens a copy (tiers, API/supplier IDs, video, features) as a NEW unsaved product. Change the name (and category, e.g. android → ios), press Save. Nothing is created until you save.

## Also in this version
- Feature list: only a centred down-arrow (no words) to expand.
- Maintenance products stay at the bottom; no SQL changes.
- Guild Glory is main-store only. Region and group costs: 1 credit = 1 group (`GROUP_CREDITS` in `lib/guild-glory.ts`; change it if the seller's price differs).
- The seller's local tester login (testing / test_key1234) is not used by the shop.
