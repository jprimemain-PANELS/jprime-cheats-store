-- 002: run ONLY after the new code is live and tested, and BEFORE any co-admin store
-- is activated. Replaces the old GLOBAL unique indexes with the tenant-scoped ones.
-- Each block is independent and guarded. NOT RUN BY ME.
BEGIN;

-- Old global uniques would stop two tenants having the same product/price rows.
DROP INDEX IF EXISTS public.product_prices_product_name_duration_uidx;
DROP INDEX IF EXISTS public.reseller_price_overrides_user_product_duration_uidx;
ALTER TABLE public.products_catalog DROP CONSTRAINT IF EXISTS products_catalog_product_id_key;

-- Unique account per (tenant, username): created ONLY if no duplicates exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users GROUP BY tenant_id, username HAVING count(*) > 1) THEN
    RAISE NOTICE 'SKIPPED users unique index: duplicate usernames exist. Resolve them (see 000 block A), then re-run this block.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_username_uidx ON public.users (tenant_id, username);
  END IF;

  IF EXISTS (SELECT 1 FROM public.wallets WHERE username IS NOT NULL GROUP BY tenant_id, username HAVING count(*) > 1) THEN
    RAISE NOTICE 'SKIPPED wallets unique index: duplicate wallet rows exist; they merge when the wallet is next used. Re-run later.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS wallets_tenant_username_uidx ON public.wallets (tenant_id, username)
      WHERE username IS NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.deposit_history WHERE gateway_order_id IS NOT NULL
             GROUP BY gateway_order_id HAVING count(*) > 1) THEN
    RAISE NOTICE 'SKIPPED deposit_history gateway_order_id unique index: duplicates exist.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS deposit_history_gateway_order_uidx
      ON public.deposit_history (gateway_order_id) WHERE gateway_order_id IS NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.deposit_history WHERE utr IS NOT NULL AND btrim(utr) <> ''
             GROUP BY utr HAVING count(*) > 1) THEN
    RAISE NOTICE 'SKIPPED deposit_history utr unique index: duplicates exist.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS deposit_history_utr_uidx
      ON public.deposit_history (utr) WHERE utr IS NOT NULL AND btrim(utr) <> '';
  END IF;
END $$;

-- The OLD username-only wallet functions would act across ALL stores if anything ever called
-- them (they merge wallets by username alone). The new code only uses jprime_t_*; take the
-- old ones away from every role. Reversible: GRANT EXECUTE ... TO service_role.
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.jprime_wallet_consolidate(text,boolean)', 'public.jprime_wallet_get_balance(text)',
    'public.jprime_wallet_get_or_create_balance(text)', 'public.jprime_wallet_credit(text,numeric)',
    'public.jprime_wallet_debit(text,numeric)', 'public.jprime_finalize_wallet_deposit(text,text,text,numeric)']
  LOOP
    IF to_regprocedure(f) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f);
    END IF;
  END LOOP;
END $$;
COMMIT;

-- LATER (Phase 2, once every insert path sends tenant_id): make forgetting a tenant fail loudly:
--   ALTER TABLE public.<table> ALTER COLUMN tenant_id DROP DEFAULT;   -- for the 10 tables
