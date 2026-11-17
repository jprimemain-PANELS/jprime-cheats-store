# v15a - tahir seller, Create account, working Forgot password

## 1. Run SQL (after a backup) - Supabase > SQL Editor
Run `supabase/tenant/008_SELLER3.sql` (safe to run twice). Rollback: `008_SELLER3_ROLLBACK.sql`.
If you have not run 004-007 yet, run them first, in order.

## 2. tahir seller (SELLER3)
- Vercel > Settings > Environment Variables: add `SELLER3_API_TOKEN` = your Admin Shops token, then Redeploy.
- Admin > Products > a duration > Supplier = "tahir seller" > enter the numeric Product ID from its catalog (e.g. 62).
- Co-admin stores use their own key via API SYSTEM (assign them "tahir seller").
- Never paste the token in chat or code.

## 3. Create account (Users tab, owner admin AND every co-admin store)
Create account button > username, password, role, optional starting balance/email/mobile.
Co-admin stores can create User/Reseller only; only the owner store can create Admin.
The starting balance appears in the user's ledger as "Admin added starting balance".

## 4. Forgot password (works without email, free)
1. Customer: login page > Forgot password? > username (+ optional signup mobile number) > Send request.
2. Admin: Users tab shows "forgot password" (with a tick if the mobile matched) > Reset code > send the code by WhatsApp/Telegram.
3. Customer: Forgot password? > "I have a code" > username + code + new password.
Codes last 24 hours, work once, are stored hashed, and lock after 5 wrong tries. The old "Reset password" (temporary password) still works.
