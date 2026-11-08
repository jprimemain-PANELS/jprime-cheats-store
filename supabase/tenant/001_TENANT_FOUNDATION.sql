-- =====================================================================
-- 001: TENANT FOUNDATION  (ADDITIVE ONLY — nothing is dropped, rewritten or merged)
-- NOT RUN BY ME. Review, take a backup, run on staging/branch first.
--
-- What it does
--   1. Creates tenants, tenant_domains, tenant_applications, tenant_settings, audit_log.
--   2. Inserts the JPRIME OWNER tenant (fixed id ...0001) and its two domains.
--   3. Adds tenant_id (NOT NULL, DEFAULT = JPRIME) to the 10 tenant-owned tables.
--      Postgres applies a constant default to existing rows without rewriting them,
--      so every existing row belongs to JPRIME immediately. Old code that does not
--      send tenant_id keeps working (lands in JPRIME).
--   4. Adds tenant-scoped UNIQUE indexes beside the old ones (old ones are dropped
--      later in 002).
--   5. Adds tenant-aware wallet/deposit functions (jprime_t_*). The old jprime_*
--      functions are left untouched.
--   6. Verifies row counts and the total wallet balance did not change; if anything
--      differs the whole transaction rolls back.
-- Deploy order: run this -> deploy the new code -> (later) run 002.
-- =====================================================================
BEGIN;

CREATE TEMP TABLE _pre ON COMMIT DROP AS
SELECT 'users' t, count(*)::numeric n FROM public.users UNION ALL
SELECT 'wallets', count(*) FROM public.wallets UNION ALL
SELECT 'wallet_transactions', count(*) FROM public.wallet_transactions UNION ALL
SELECT 'deposit_history', count(*) FROM public.deposit_history UNION ALL
SELECT 'payment_orders', count(*) FROM public.payment_orders UNION ALL
SELECT 'purchase_history', count(*) FROM public.purchase_history UNION ALL
SELECT 'stock_keys', count(*) FROM public.stock_keys UNION ALL
SELECT 'product_prices', count(*) FROM public.product_prices UNION ALL
SELECT 'products_catalog', count(*) FROM public.products_catalog UNION ALL
SELECT 'reseller_price_overrides', count(*) FROM public.reseller_price_overrides UNION ALL
SELECT 'wallet_balance_sum', COALESCE(sum(balance), 0) FROM public.wallets;

-- ---------- 1. new tables ----------
CREATE TABLE IF NOT EXISTS public.tenants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE
                      CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'),
  kind                text NOT NULL CHECK (kind IN ('owner', 'coadmin')),
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
  brand_name          text NOT NULL,
  telegram_username   text,
  inventory_mode      text NOT NULL DEFAULT 'own_api'
                      CHECK (inventory_mode IN ('own_api', 'shared_stock')),
  shared_stock_allowed boolean NOT NULL DEFAULT false,
  coadmin_user_id     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  approved_at         timestamptz,
  suspended_at        timestamptz
);
-- exactly one owner tenant
CREATE UNIQUE INDEX IF NOT EXISTS tenants_one_owner_uidx ON public.tenants ((kind)) WHERE kind = 'owner';

CREATE TABLE IF NOT EXISTS public.tenant_domains (
  host        text PRIMARY KEY CHECK (host = lower(host)),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id),
  is_primary  boolean NOT NULL DEFAULT false,
  verified    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tenant_domains_tenant_idx ON public.tenant_domains (tenant_id);

CREATE TABLE IF NOT EXISTS public.tenant_applications (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id      text NOT NULL,
  applicant_tenant_id    uuid NOT NULL REFERENCES public.tenants(id),
  brand_name             text NOT NULL,
  slug                   text NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'),
  telegram_username      text,
  inventory_mode         text NOT NULL DEFAULT 'own_api' CHECK (inventory_mode IN ('own_api', 'shared_stock')),
  contact_email          text,
  contact_phone          text,
  coadmin_username       text NOT NULL,
  coadmin_password_hash  text NOT NULL,   -- scrypt hash only, never plaintext
  status                 text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by            text,
  reviewed_at            timestamptz,
  review_note            text,
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_applications_slug_open_uidx
  ON public.tenant_applications (slug) WHERE status IN ('pending', 'approved');

CREATE TABLE IF NOT EXISTS public.tenant_settings (
  tenant_id   uuid PRIMARY KEY REFERENCES public.tenants(id),
  theme       jsonb NOT NULL DEFAULT '{}'::jsonb,   -- validated server-side against an allowlist
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id       uuid REFERENCES public.tenants(id),
  actor_user_id   text,
  actor_username  text,
  action          text NOT NULL,
  target          text,
  reason          text,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_tenant_idx ON public.audit_log (tenant_id, created_at DESC);

-- ---------- 2. owner tenant ----------
INSERT INTO public.tenants (id, slug, kind, status, brand_name, approved_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'jprime', 'owner', 'active', 'JPRIME STORE', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenant_domains (host, tenant_id, is_primary, verified) VALUES
  ('jprimecheats.store',     '00000000-0000-0000-0000-000000000001', true,  true),
  ('www.jprimecheats.store', '00000000-0000-0000-0000-000000000001', false, true)
ON CONFLICT (host) DO NOTHING;

INSERT INTO public.tenant_settings (tenant_id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (tenant_id) DO NOTHING;

-- ---------- 3. tenant_id on tenant-owned tables ----------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','wallets','wallet_transactions','deposit_history','payment_orders',
                           'purchase_history','stock_keys','product_prices','products_catalog',
                           'reseller_price_overrides']
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid NOT NULL '
      'DEFAULT ''00000000-0000-0000-0000-000000000001'' REFERENCES public.tenants(id)', t);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS users_tenant_username_idx        ON public.users (tenant_id, username);
CREATE INDEX IF NOT EXISTS wallets_tenant_username_idx      ON public.wallets (tenant_id, username);
CREATE INDEX IF NOT EXISTS wallet_tx_tenant_user_idx        ON public.wallet_transactions (tenant_id, username);
CREATE INDEX IF NOT EXISTS deposit_tenant_user_idx          ON public.deposit_history (tenant_id, username);
CREATE INDEX IF NOT EXISTS payment_orders_tenant_user_idx   ON public.payment_orders (tenant_id, username);
CREATE INDEX IF NOT EXISTS purchase_tenant_user_idx         ON public.purchase_history (tenant_id, username);
CREATE INDEX IF NOT EXISTS stock_keys_tenant_product_idx    ON public.stock_keys (tenant_id, product_name, duration);

-- ---------- 4. tenant-scoped uniques (existing data already satisfies them) ----------
CREATE UNIQUE INDEX IF NOT EXISTS product_prices_tenant_name_duration_uidx
  ON public.product_prices (tenant_id, product_name, duration);
CREATE UNIQUE INDEX IF NOT EXISTS reseller_overrides_tenant_user_product_duration_uidx
  ON public.reseller_price_overrides (tenant_id, username, product_name, duration);
CREATE UNIQUE INDEX IF NOT EXISTS products_catalog_tenant_product_id_uidx
  ON public.products_catalog (tenant_id, product_id);

-- ---------- 5. tenant-aware wallet functions (old jprime_* left untouched) ----------
-- Same behaviour as the live jprime_wallet_* functions, but every lookup is
-- (tenant_id, username) and the advisory lock key includes the tenant.
CREATE OR REPLACE FUNCTION public.jprime_t_wallet_consolidate(p_tenant uuid, p_username text, p_create boolean DEFAULT false)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE keeper_id text; total_balance numeric;
BEGIN
  IF p_tenant IS NULL OR p_username IS NULL OR btrim(p_username) = '' THEN
    RAISE EXCEPTION 'Invalid wallet tenant/username';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('jprime-wallet:' || p_tenant::text || ':' || p_username, 0));

  SELECT id INTO keeper_id FROM public.wallets
  WHERE tenant_id = p_tenant AND username = p_username
  ORDER BY CASE WHEN COALESCE(balance, 0) <> 0 THEN 0 ELSE 1 END, created_at ASC NULLS LAST, id ASC
  LIMIT 1 FOR UPDATE;

  IF keeper_id IS NULL THEN
    IF NOT p_create THEN RETURN 0; END IF;
    INSERT INTO public.wallets (tenant_id, username, balance, created_at, updated_at)
    VALUES (p_tenant, p_username, 0, NOW()::text, NOW()::text) RETURNING id INTO keeper_id;
  END IF;

  SELECT COALESCE(SUM(COALESCE(balance, 0)), 0) INTO total_balance
  FROM public.wallets WHERE tenant_id = p_tenant AND username = p_username;

  UPDATE public.wallets SET balance = total_balance, updated_at = NOW()::text WHERE id = keeper_id;
  DELETE FROM public.wallets WHERE tenant_id = p_tenant AND username = p_username AND id <> keeper_id;
  RETURN total_balance;
END $function$;

CREATE OR REPLACE FUNCTION public.jprime_t_wallet_get_balance(p_tenant uuid, p_username text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$ BEGIN RETURN public.jprime_t_wallet_consolidate(p_tenant, p_username, false); END $function$;

CREATE OR REPLACE FUNCTION public.jprime_t_wallet_get_or_create_balance(p_tenant uuid, p_username text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$ BEGIN RETURN public.jprime_t_wallet_consolidate(p_tenant, p_username, true); END $function$;

CREATE OR REPLACE FUNCTION public.jprime_t_wallet_credit(p_tenant uuid, p_username text, p_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE cur numeric; nxt numeric;
BEGIN
  IF p_tenant IS NULL OR p_username IS NULL OR btrim(p_username) = '' OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  cur := public.jprime_t_wallet_consolidate(p_tenant, p_username, true);
  nxt := ROUND(cur + ROUND(p_amount, 2), 2);
  UPDATE public.wallets SET balance = nxt, updated_at = NOW()::text
  WHERE tenant_id = p_tenant AND username = p_username;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet row missing after creation'; END IF;
  RETURN jsonb_build_object('ok', true, 'balance', nxt);
END $function$;

CREATE OR REPLACE FUNCTION public.jprime_t_wallet_debit(p_tenant uuid, p_username text, p_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE cur numeric; nxt numeric;
BEGIN
  IF p_tenant IS NULL OR p_username IS NULL OR btrim(p_username) = '' OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  cur := public.jprime_t_wallet_consolidate(p_tenant, p_username, false);
  IF cur < ROUND(p_amount, 2) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'balance', cur);
  END IF;
  nxt := ROUND(cur - ROUND(p_amount, 2), 2);
  UPDATE public.wallets SET balance = nxt, updated_at = NOW()::text
  WHERE tenant_id = p_tenant AND username = p_username;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'balance', 0); END IF;
  RETURN jsonb_build_object('ok', true, 'balance', nxt);
END $function$;

-- Deposit finalizer: same rules as jprime_finalize_wallet_deposit, but the deposit
-- must belong to the tenant, and the credit/ledger rows are written for that tenant.
-- A UTR is a bank reference, so duplicate-UTR protection stays GLOBAL across tenants.
CREATE OR REPLACE FUNCTION public.jprime_t_finalize_wallet_deposit(
  p_tenant uuid, p_gateway_order_id text, p_username text, p_utr text, p_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE dep RECORD; nutr text; dup boolean := false; cr jsonb; bal numeric;
BEGIN
  nutr := regexp_replace(COALESCE(p_utr, ''), '[^0-9]', '', 'g');
  IF p_tenant IS NULL OR p_gateway_order_id IS NULL OR btrim(p_gateway_order_id) = ''
     OR p_username IS NULL OR btrim(p_username) = '' OR p_amount IS NULL OR p_amount <= 0
     OR length(nutr) < 10 OR length(nutr) > 30 THEN
    RETURN jsonb_build_object('ok', false, 'status', 'invalid_request');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('jprime-utr:' || nutr, 0));

  SELECT * INTO dep FROM public.deposit_history
  WHERE gateway_order_id::text = p_gateway_order_id AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND OR dep.username IS DISTINCT FROM p_username THEN
    RETURN jsonb_build_object('ok', false, 'status', 'not_found');
  END IF;
  IF dep.status = 'success' THEN RETURN jsonb_build_object('ok', false, 'status', 'already_verified'); END IF;
  IF dep.status IS DISTINCT FROM 'pending' THEN RETURN jsonb_build_object('ok', false, 'status', 'invalid_state'); END IF;
  IF length(regexp_replace(COALESCE(dep.utr::text, ''), '[^0-9]', '', 'g')) BETWEEN 10 AND 30 THEN
    RETURN jsonb_build_object('ok', false, 'status', 'manual_review');
  END IF;
  IF ABS(COALESCE(dep.amount::numeric, 0) - p_amount) > 0.01 THEN
    RETURN jsonb_build_object('ok', false, 'status', 'amount_mismatch');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.deposit_history d
    WHERE d.id <> dep.id
      AND NULLIF(regexp_replace(COALESCE(d.utr::text, ''), '[^0-9]', '', 'g'), '') = nutr) INTO dup;
  IF dup THEN RETURN jsonb_build_object('ok', false, 'status', 'duplicate_utr'); END IF;

  SELECT EXISTS (SELECT 1 FROM public.payment_orders po
    WHERE NULLIF(regexp_replace(COALESCE(po.utr::text, ''), '[^0-9]', '', 'g'), '') = nutr) INTO dup;
  IF dup THEN RETURN jsonb_build_object('ok', false, 'status', 'duplicate_utr'); END IF;

  cr := public.jprime_t_wallet_credit(p_tenant, p_username, ROUND(p_amount, 2));
  IF COALESCE((cr ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Wallet credit rejected verified deposit %', p_gateway_order_id;
  END IF;
  bal := (cr ->> 'balance')::numeric;

  UPDATE public.deposit_history SET status = 'success', utr = nutr
  WHERE id = dep.id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Deposit status changed while finalizing %', p_gateway_order_id; END IF;

  INSERT INTO public.wallet_transactions (tenant_id, username, type, amount, balance_after, description)
  VALUES (p_tenant, p_username, 'deposit', ROUND(p_amount, 2)::text, bal::text, 'Wallet Deposit Verification Successful');

  RETURN jsonb_build_object('ok', true, 'status', 'success', 'balance', bal);
END $function$;

-- ---------- 6. permissions: server (service_role) only ----------
ALTER TABLE public.tenants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_domains      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log           ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenants, public.tenant_domains, public.tenant_applications,
              public.tenant_settings, public.audit_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.tenants, public.tenant_domains, public.tenant_applications,
             public.tenant_settings, public.audit_log TO service_role;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'jprime_t_wallet_consolidate(uuid,text,boolean)', 'jprime_t_wallet_get_balance(uuid,text)',
    'jprime_t_wallet_get_or_create_balance(uuid,text)', 'jprime_t_wallet_credit(uuid,text,numeric)',
    'jprime_t_wallet_debit(uuid,text,numeric)', 'jprime_t_finalize_wallet_deposit(uuid,text,text,text,numeric)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

-- ---------- 7. self-check: nothing lost, everything is JPRIME ----------
DO $$
DECLARE r RECORD; now_n numeric; bad int;
BEGIN
  FOR r IN SELECT t, n FROM _pre LOOP
    IF r.t = 'wallet_balance_sum' THEN
      SELECT COALESCE(sum(balance), 0) INTO now_n FROM public.wallets;
    ELSE
      EXECUTE format('SELECT count(*) FROM public.%I', r.t) INTO now_n;
    END IF;
    IF now_n IS DISTINCT FROM r.n THEN
      RAISE EXCEPTION 'MIGRATION CHECK FAILED for %: before %, after %', r.t, r.n, now_n;
    END IF;
  END LOOP;
  SELECT (SELECT count(*) FROM public.users WHERE tenant_id <> '00000000-0000-0000-0000-000000000001')
       + (SELECT count(*) FROM public.wallets WHERE tenant_id <> '00000000-0000-0000-0000-000000000001')
       + (SELECT count(*) FROM public.purchase_history WHERE tenant_id <> '00000000-0000-0000-0000-000000000001')
  INTO bad;
  IF bad <> 0 THEN RAISE EXCEPTION 'MIGRATION CHECK FAILED: % rows not in JPRIME tenant', bad; END IF;
END $$;

COMMIT;
-- If you see no error, counts and the total wallet balance were identical before/after.
