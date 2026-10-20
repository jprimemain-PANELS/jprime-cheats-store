-- JPRIME STORE wallet repair and atomic wallet RPCs.
-- Requires the existing backup tables created during the investigation:
--   public.wallets_all_duplicates_backup (186 rows)
--   public.wallet_transactions_all_duplicates_backup (17 rows)
-- This script does NOT edit/delete wallet_transactions and does NOT merge
-- usernames that only differ by case or whitespace.

BEGIN;

-- Refuse to mutate live balances unless the existing backups are present.
DO $guard$
BEGIN
  IF to_regclass('public.wallets_all_duplicates_backup') IS NULL THEN
    RAISE EXCEPTION 'Missing public.wallets_all_duplicates_backup. Stop and create/verify the wallet backup first.';
  END IF;
  IF to_regclass('public.wallet_transactions_all_duplicates_backup') IS NULL THEN
    RAISE EXCEPTION 'Missing public.wallet_transactions_all_duplicates_backup. Stop and create/verify the transaction backup first.';
  END IF;
  IF (SELECT COUNT(*) FROM public.wallets_all_duplicates_backup) < 1 THEN
    RAISE EXCEPTION 'The wallet backup is empty. Stop before modifying live data.';
  END IF;
END
$guard$;

-- Create an additional one-time backup of rows that are duplicated by the
-- exact username value (case and spaces preserved). This is independent of the
-- broader lower(trim(username)) backup already created.
CREATE TABLE IF NOT EXISTS public.wallets_exact_duplicates_pre_repair_backup AS
SELECT * FROM public.wallets WHERE FALSE;

INSERT INTO public.wallets_exact_duplicates_pre_repair_backup
SELECT w.*
FROM public.wallets AS w
WHERE w.username IS NOT NULL
  AND btrim(w.username) <> ''
  AND w.username IN (
    SELECT username
    FROM public.wallets
    WHERE username IS NOT NULL
      AND btrim(username) <> ''
    GROUP BY username
    HAVING COUNT(*) > 1
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.wallets_exact_duplicates_pre_repair_backup AS b
    WHERE b.id = w.id
  );

-- Consolidate only records whose username values are EXACTLY identical.
-- Select a keeper (prefer a row with a nonzero balance, then the oldest row),
-- put the sum of balances on it, and remove only its exact-name duplicate rows.
-- All original duplicate wallet rows remain recoverable in the backup tables.
DO $repair$
DECLARE
  r RECORD;
  keeper_id TEXT;
  total_balance NUMERIC;
BEGIN
  FOR r IN
    SELECT username
    FROM public.wallets
    WHERE username IS NOT NULL
      AND btrim(username) <> ''
    GROUP BY username
    HAVING COUNT(*) > 1
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('jprime-wallet:' || r.username, 0));

    SELECT id
    INTO keeper_id
    FROM public.wallets
    WHERE username = r.username
    ORDER BY
      CASE WHEN COALESCE(balance, 0) <> 0 THEN 0 ELSE 1 END,
      created_at ASC NULLS LAST,
      id ASC
    LIMIT 1
    FOR UPDATE;

    SELECT COALESCE(SUM(COALESCE(balance, 0)), 0)
    INTO total_balance
    FROM public.wallets
    WHERE username = r.username;

    UPDATE public.wallets
    SET balance = total_balance,
        updated_at = NOW()::TEXT
    WHERE id = keeper_id;

    DELETE FROM public.wallets
    WHERE username = r.username
      AND id <> keeper_id;
  END LOOP;
END
$repair$;

-- Enforce at most one wallet per exact username. Case/space variants remain
-- separate because the legacy users table contains variants that may represent
-- different account records. Signup trims new usernames.
CREATE UNIQUE INDEX IF NOT EXISTS wallets_username_exact_uidx
ON public.wallets (username)
WHERE username IS NOT NULL AND btrim(username) <> '';

-- Internal helper: lock one exact username, create if requested, combine any
-- remaining exact-match rows, and return its effective balance.
CREATE OR REPLACE FUNCTION public.jprime_wallet_consolidate(
  p_username TEXT,
  p_create BOOLEAN DEFAULT FALSE
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  keeper_id TEXT;
  total_balance NUMERIC;
BEGIN
  IF p_username IS NULL OR btrim(p_username) = '' THEN
    RAISE EXCEPTION 'Invalid wallet username';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('jprime-wallet:' || p_username, 0));

  SELECT id
  INTO keeper_id
  FROM public.wallets
  WHERE username = p_username
  ORDER BY
    CASE WHEN COALESCE(balance, 0) <> 0 THEN 0 ELSE 1 END,
    created_at ASC NULLS LAST,
    id ASC
  LIMIT 1
  FOR UPDATE;

  IF keeper_id IS NULL THEN
    IF NOT p_create THEN
      RETURN 0;
    END IF;

    INSERT INTO public.wallets (username, balance, created_at, updated_at)
    VALUES (p_username, 0, NOW()::TEXT, NOW()::TEXT)
    ON CONFLICT (username)
      WHERE username IS NOT NULL AND btrim(username) <> ''
    DO NOTHING;

    SELECT id
    INTO keeper_id
    FROM public.wallets
    WHERE username = p_username
    ORDER BY id ASC
    LIMIT 1
    FOR UPDATE;
  END IF;

  SELECT COALESCE(SUM(COALESCE(balance, 0)), 0)
  INTO total_balance
  FROM public.wallets
  WHERE username = p_username;

  UPDATE public.wallets
  SET balance = total_balance,
      updated_at = NOW()::TEXT
  WHERE id = keeper_id;

  DELETE FROM public.wallets
  WHERE username = p_username
    AND id <> keeper_id;

  RETURN total_balance;
END
$function$;

CREATE OR REPLACE FUNCTION public.jprime_wallet_get_balance(p_username TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN public.jprime_wallet_consolidate(p_username, FALSE);
END
$function$;

CREATE OR REPLACE FUNCTION public.jprime_wallet_get_or_create_balance(p_username TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN public.jprime_wallet_consolidate(p_username, TRUE);
END
$function$;

CREATE OR REPLACE FUNCTION public.jprime_wallet_credit(p_username TEXT, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  current_balance NUMERIC;
  next_balance NUMERIC;
BEGIN
  IF p_username IS NULL OR btrim(p_username) = '' OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'invalid');
  END IF;

  current_balance := public.jprime_wallet_consolidate(p_username, TRUE);
  next_balance := ROUND(current_balance + ROUND(p_amount, 2), 2);

  UPDATE public.wallets
  SET balance = next_balance,
      updated_at = NOW()::TEXT
  WHERE username = p_username;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet row missing after creation';
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'balance', next_balance);
END
$function$;

CREATE OR REPLACE FUNCTION public.jprime_wallet_debit(p_username TEXT, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  current_balance NUMERIC;
  next_balance NUMERIC;
BEGIN
  IF p_username IS NULL OR btrim(p_username) = '' OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'invalid');
  END IF;

  current_balance := public.jprime_wallet_consolidate(p_username, FALSE);
  IF current_balance < ROUND(p_amount, 2) THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'insufficient', 'balance', current_balance);
  END IF;

  next_balance := ROUND(current_balance - ROUND(p_amount, 2), 2);
  UPDATE public.wallets
  SET balance = next_balance,
      updated_at = NOW()::TEXT
  WHERE username = p_username;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'insufficient', 'balance', 0);
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'balance', next_balance);
END
$function$;

-- Only the server's service-role client may execute these functions.
REVOKE ALL ON FUNCTION public.jprime_wallet_consolidate(TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jprime_wallet_get_balance(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jprime_wallet_get_or_create_balance(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jprime_wallet_credit(TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jprime_wallet_debit(TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.jprime_wallet_consolidate(TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.jprime_wallet_get_balance(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.jprime_wallet_get_or_create_balance(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.jprime_wallet_credit(TEXT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.jprime_wallet_debit(TEXT, NUMERIC) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Verification (run separately after this script):
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE schemaname = 'public' AND tablename = 'wallets' ORDER BY indexname;
-- SELECT LOWER(TRIM(username)) AS normalized_username, COUNT(*) AS wallet_count,
--        SUM(COALESCE(balance, 0)) AS total_balance
-- FROM public.wallets WHERE username IS NOT NULL AND BTRIM(username) <> ''
-- GROUP BY LOWER(TRIM(username)) HAVING COUNT(*) > 1
-- ORDER BY wallet_count DESC;
