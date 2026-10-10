-- =====================================================================
-- JPRIME CHEATS STORE - security migration  (NON-DESTRUCTIVE)
-- Nothing here deletes, truncates, rewrites or resets any row.
-- Read every step. Take a database backup first. Run in the Supabase SQL editor.
-- I have NOT run this against your database (I have no access to it).
-- =====================================================================

-- ---------------------------------------------------------------------
-- STEP 0 (read-only): look at the current state before changing anything
-- ---------------------------------------------------------------------
-- Which tables does the public anon key currently have access to?
SELECT table_name, grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- Which tables have RLS enabled, and which policies exist?
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1;
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public';

-- Does the SQL function behind /api/payment-webhook run as its owner, and who can call it?
SELECT p.proname, p.prosecdef AS security_definer, p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'process_payment_and_release_key';

-- ---------------------------------------------------------------------
-- STEP 1 (additive, safe): UTR replay protection for UPI purchases
-- Adds one nullable column + a partial unique index. Existing rows are untouched.
-- The app works with or without this step; with it, the SAME UTR can never settle two orders.
-- ---------------------------------------------------------------------
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS utr text;

-- Before creating the unique index, make sure no duplicates already exist
-- (this must return 0 rows; if it returns rows, investigate them manually first):
SELECT utr, count(*) FROM public.payment_orders WHERE utr IS NOT NULL GROUP BY utr HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_utr_unique
  ON public.payment_orders (utr) WHERE utr IS NOT NULL;

-- Same check for wallet deposits (deposit_history already has a utr column):
SELECT utr, count(*) FROM public.deposit_history WHERE utr IS NOT NULL GROUP BY utr HAVING count(*) > 1;
-- Only if the query above returns 0 rows:
CREATE UNIQUE INDEX IF NOT EXISTS deposit_history_utr_unique
  ON public.deposit_history (utr) WHERE utr IS NOT NULL;

-- ---------------------------------------------------------------------
-- STEP 2 (do this ONLY AFTER the new code is deployed and you have tested
--         login, wallet purchase, UPI purchase and the admin panel):
-- Lock the tables so the public anon key can no longer read/write them directly.
-- Your server routes use the service-role key, which is NOT affected by these changes.
-- This changes permissions only - no data is touched. It is reversible with GRANT.
-- ---------------------------------------------------------------------
BEGIN;

ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_keys          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products_catalog    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_price_overrides ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.users               FROM anon, authenticated;
REVOKE ALL ON public.wallets             FROM anon, authenticated;
REVOKE ALL ON public.wallet_transactions FROM anon, authenticated;
REVOKE ALL ON public.payment_orders      FROM anon, authenticated;
REVOKE ALL ON public.deposit_history     FROM anon, authenticated;
REVOKE ALL ON public.purchase_history    FROM anon, authenticated;
REVOKE ALL ON public.stock_keys          FROM anon, authenticated;
REVOKE ALL ON public.product_prices      FROM anon, authenticated;
REVOKE ALL ON public.products_catalog    FROM anon, authenticated;
REVOKE ALL ON public.reseller_price_overrides FROM anon, authenticated;

-- The payment webhook RPC must only be callable with the service-role key.
REVOKE ALL ON FUNCTION public.process_payment_and_release_key(text) FROM PUBLIC, anon, authenticated;
-- (If the line above errors with "function does not exist", copy the exact argument types from STEP 0.)

COMMIT;

-- Verify: this should now return no rows for anon/authenticated on those tables.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')
  AND table_name IN ('users','wallets','wallet_transactions','payment_orders','deposit_history',
                     'purchase_history','stock_keys','product_prices','products_catalog','reseller_price_overrides');

-- ROLLBACK (only if something unexpectedly breaks; restores the previous open access):
-- GRANT ALL ON public.<table> TO anon, authenticated;
