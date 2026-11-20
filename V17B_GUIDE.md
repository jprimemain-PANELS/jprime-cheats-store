# v17b — Guild Glory via your API, partner websites, private reseller alerts

1. **Co-admin stores use YOUR seller API automatically** (like JPRIME API stock). No seller key for co-admins. Each group a customer launches takes your price for one token (reseller / VIP price rules, from your Guild product's 1-token plan) from the store's payer wallet on the main site. If that wallet is low, the customer sees "Out of stock" and keeps their credit. If the bot cannot start, both the payer money and the customer credit are returned. The co-admin sets their own selling prices. Needs the store to be allowed JPRIME API stock with a payer wallet linked (same as JPRIME API products).
2. **Partner websites (other people's own sites)**: Admin -> **Guild partners**. Create a partner (name + their wallet username on your site + optional fixed price per group) -> you get an API key shown once. Give them `GUILD_PARTNER_API.md` and the key. Their site calls your site; they never get your seller website, key or hosting. Each group charges their wallet; refunds on failure; Idempotency-Key supported; they only see their own groups.
3. **Telegram**: purchases by resellers / VIP resellers no longer show the price (the alert says "Type: Reseller"); customers' alerts unchanged.

Install: unzip over the project. No SQL, no new env variables.
