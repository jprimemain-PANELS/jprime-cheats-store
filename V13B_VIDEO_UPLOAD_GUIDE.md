# Gallery video upload (admin + co-admin product form)

Video goes phone -> Cloudflare R2 directly. Supabase storage and Vercel are NOT used. Your database stores only the link.
Without the setup below the product form behaves exactly as before (paste a link); the upload box appears only when R2 is configured.

## One-time setup (about 10 minutes, free)
1. Cloudflare dashboard -> R2 -> Create bucket (e.g. `jprime-videos`). R2 free: 10 GB storage, NO download fees. (Card may be asked for activation.)
2. Bucket -> Settings -> Public access -> connect a custom domain such as `videos.adminshop.store` (or enable the r2.dev URL for testing). This is your R2_PUBLIC_URL.
3. R2 -> Manage API tokens -> Create token, permission "Object Read & Write", limited to that bucket. Copy Access Key ID + Secret.
4. Bucket -> Settings -> CORS policy, paste:
```
[{"AllowedOrigins":["https://jprimecheats.store","https://*.adminshop.store"],"AllowedMethods":["PUT"],"AllowedHeaders":["content-type"],"MaxAgeSeconds":3600}]
```
(add any other store domain you use)
5. Vercel -> Project -> Environment Variables (Production), then redeploy:
   - R2_ACCOUNT_ID  (Cloudflare account id, R2 page right side)
   - R2_ACCESS_KEY_ID
   - R2_SECRET_ACCESS_KEY
   - R2_BUCKET
   - R2_PUBLIC_URL  (https://videos.adminshop.store, no trailing slash)

## How it works / safety
- Admin and co-admin only (store session checked). Each store's files go in `videos/<store-id>/`.
- Only MP4/WebM/MOV/MKV/AVI, max 200 MB; link valid 15 minutes, locked to the chosen file type; 15 requests/min limit.
- Old Supabase video links keep working.
- Deleting a product does not delete its R2 file (10 GB is a lot; clean from the Cloudflare dashboard if needed).
