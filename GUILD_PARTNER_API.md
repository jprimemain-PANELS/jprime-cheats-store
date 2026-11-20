# Guild Glory Partner API (for other websites)

Your website sells Guild Glory to YOUR customers. The bots run from the main website's seller, and every group is charged to your partner wallet on the main website. You keep your own prices and your own customer wallets.

Base address: `https://<main-website>/api/partner/guild`
Header on every call: `Authorization: Bearer gp_...` (the key the owner gave you)

| Call | What it does |
|---|---|
| GET `/account` | `{balance, cost_per_group}` of your partner wallet |
| GET `/regions` | Available account regions |
| POST `/groups` | Body `{ "region": "in", "clan_id": "123456789" }`. Optional header `Idempotency-Key` (8-64 chars) so a retry never charges twice. Returns 201 `{group:{ref,...}, charged, balance}`. 402 = wallet too low. The charge is returned automatically if the bot cannot start |
| GET `/groups` | Your groups |
| GET `/groups/{ref}` | Live info (name, glory, members, bots...). `?view=history` or `?view=players` for lists |
| POST `/groups/{ref}/actions` | Body `{ "action": "restart" \| "stop" \| "refresh" }` |
| DELETE `/groups/{ref}` | Stop and remove the group |

Rules: you only see and control groups you created. Up to 90 calls per minute. Top up your partner wallet on the main website like any user. A new group may show as "starting" (409 on detail) for a few seconds.

Typical flow on your site: customer pays you -> your server calls POST `/groups` -> show the group info from GET `/groups/{ref}`.
