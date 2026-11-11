# Second domain for small resellers (keep jprimecheats.store exactly as it is)

Result: new stores get  rajstore.adminsellers.store  (use your real new domain name below).
Your main site, your old links and every store already created keep working. NO code change is needed: only 4 settings.

## 1. Buy the domain (GoDaddy, about 99 rs)
Buy e.g. adminsellers.store. Do not add any hosting.

## 2. Put its DNS on Cloudflare (free, same as your main domain)
1. Cloudflare > Add a site > type the new domain > choose the Free plan.
2. Cloudflare shows two name servers. GoDaddy > your domain > DNS / Nameservers > Change > "I'll use my own nameservers" > paste the two > Save.
3. Wait until Cloudflare says the site is Active (5 minutes to a few hours).

## 3. Add the records in Cloudflare (new domain > DNS > Records)
- CNAME | Name *  | Target cname.vercel-dns.com | Proxy: grey cloud (DNS only) | Save
- NS | Name _acme-challenge | ns1.vercel-dns.com | Save
- NS | Name _acme-challenge | ns2.vercel-dns.com | Save
(Type "NS" in the Type box if you cannot find it.)

## 4. Vercel
1. Project > Settings > Domains > Add: *.adminsellers.store  (type the star too). Add the plain adminsellers.store as well. Press Refresh until it turns green (up to an hour).
2. Project > Settings > Environment Variables: change PLATFORM_ROOT_DOMAIN from jprimecheats.store to adminsellers.store (Production). Save.
3. Deployments > top one > Redeploy.
IMPORTANT: keep *.jprimecheats.store in Vercel. Stores already created stay on it.

## 5. Test
Owner admin > Co-admins > New store > name "test3". It must show  test3.adminsellers.store . Open it.
The Launch page for resellers shows the new address too.

## Notes
- Old stores keep their old address. A small store that wants the new one can be moved by me later (tell me which).
- Vercel Hobby is non-commercial and limited to 50 domains. Wildcards count as one. If you sell stores for money, Vercel Pro is the proper plan.
- Supabase needs nothing for this.
