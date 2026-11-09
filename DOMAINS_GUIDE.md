# Domains: how it works (plain English)

A "domain" is just the web address. Your website is served by ONE Vercel project. Vercel looks at the address the visitor typed, and our code looks that address up in the table `tenant_domains` to decide WHICH store to show. So giving a store an address = adding a row + telling Vercel to accept that address.

## Option 1: FREE address for small resellers  (`andrews.<your-domain>`)
Nothing to buy per reseller. When you approve a store, the system creates `slug.<PLATFORM_ROOT_DOMAIN>` automatically.
One-time setup (you do this once, not per reseller):
1. Decide the root domain. Cheapest/free: use the one you already own, `jprimecheats.store` -> stores look like `andrews.jprimecheats.store`.
   (There is NO free neutral domain without "JPRIME" in it. If you later buy any cheap neutral domain, just change the setting below; no code change.)
2. Vercel -> Settings -> Environment Variables -> add `PLATFORM_ROOT_DOMAIN` = `jprimecheats.store` (Production) -> Redeploy.
3. Wildcard: Vercel -> Project -> Settings -> Domains -> add `*.jprimecheats.store`. Vercel will ask you to use Vercel nameservers (ns1.vercel-dns.com / ns2.vercel-dns.com) at your registrar. BEFORE changing nameservers, copy every DNS record you currently have (email, etc.) into Vercel -> Domains -> DNS Records, otherwise they stop working.
4. Done. Approve a store and open `slug.jprimecheats.store`.
Limits to know: Vercel Hobby allows 50 domains per project, and Hobby is meant for NON-commercial use (selling to resellers is commercial; Vercel Pro is the paid fix). Wildcard works for one level only (`a.jprimecheats.store`, not `a.b.jprimecheats.store`).
Logins are separate per store (cookies are scoped per address; tested).

## Option 2: OWN domain for big resellers  (`shop.theirname.com`)
The reseller buys their own domain (they pay, not you). You control who may use it.
1. Admin -> Co-admins -> on the store press "Custom domain: off" so it says "allowed".
2. The co-admin opens Admin -> Domain, types `shop.theirname.com`, and sees 2 DNS records to add at their registrar: a TXT proof record and a CNAME to `cname.vercel-dns.com`.
3. They press "Check DNS". When it says proof found, the store shows "DNS proven" in YOUR Co-admins tab.
4. You add the same domain in Vercel (Project -> Settings -> Domains), then press "Activate" on the store. (If you set `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` env vars, Activate adds it in Vercel automatically.)
Safety: a domain serves nothing until YOU activate it; the TXT proof stops anyone claiming a domain they don't own; owner/platform addresses cannot be claimed.

## Database change
Run `supabase/tenant/004_CUSTOM_DOMAINS.sql` (backup first). It only ADDS optional columns; existing data untouched. Undo: `004_ROLLBACK.sql`. The new code works WITHOUT it (Option 1 and branding work; the Domain tab just says "not enabled yet"). Run it only when you want Option 2.

## Branding (new)
Admin -> Branding now also has: banner layout (centered / left / text+picture), product card style, corner roundness, products per row (2/3/4), page background (gradient / glow / grid / picture), button style, text size, animations, banner title/subtitle/button text, and 4 new full-layout themes (arcade, boutique, neon, slate). Your own store keeps its look unless you change it.
