-- ROLLBACK for 001. Drops only what 001 added. No original column or row is touched.
-- WARNING: once any co-admin tenant holds data, DO NOT run this: dropping tenant_id would
-- pour that tenant's users/wallets/orders into the JPRIME data set. Roll back only before launch.
BEGIN;
DROP FUNCTION IF EXISTS public.jprime_t_finalize_wallet_deposit(uuid,text,text,text,numeric);
DROP FUNCTION IF EXISTS public.jprime_t_wallet_debit(uuid,text,numeric);
DROP FUNCTION IF EXISTS public.jprime_t_wallet_credit(uuid,text,numeric);
DROP FUNCTION IF EXISTS public.jprime_t_wallet_get_or_create_balance(uuid,text);
DROP FUNCTION IF EXISTS public.jprime_t_wallet_get_balance(uuid,text);
DROP FUNCTION IF EXISTS public.jprime_t_wallet_consolidate(uuid,text,boolean);

DROP INDEX IF EXISTS public.products_catalog_tenant_product_id_uidx;
DROP INDEX IF EXISTS public.reseller_overrides_tenant_user_product_duration_uidx;
DROP INDEX IF EXISTS public.product_prices_tenant_name_duration_uidx;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','wallets','wallet_transactions','deposit_history','payment_orders',
                           'purchase_history','stock_keys','product_prices','products_catalog',
                           'reseller_price_overrides']
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS tenant_id', t);  -- also drops its index
  END LOOP;
END $$;

DROP TABLE IF EXISTS public.audit_log, public.tenant_settings, public.tenant_applications,
                     public.tenant_domains, public.tenants;
COMMIT;
-- Then redeploy the previous Vercel build (instant rollback).
