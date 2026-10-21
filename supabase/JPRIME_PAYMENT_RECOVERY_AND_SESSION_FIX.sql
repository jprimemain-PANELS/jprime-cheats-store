-- JPRIME STORE: retry-safe wallet top-up finalizer.
-- Install in the SAME Supabase project used by the deployed website.
-- This function keeps deposit status, wallet credit, and transaction ledger in
-- one PostgreSQL transaction. A failed SQL statement rolls all three changes back.

BEGIN;

CREATE OR REPLACE FUNCTION public.jprime_finalize_wallet_deposit(
  p_gateway_order_id TEXT,
  p_username TEXT,
  p_utr TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  deposit_row RECORD;
  normalized_utr TEXT;
  duplicate_utr BOOLEAN := FALSE;
  credit_result JSONB;
  credited_balance NUMERIC;
BEGIN
  normalized_utr := regexp_replace(COALESCE(p_utr, ''), '[^0-9]', '', 'g');

  IF p_gateway_order_id IS NULL OR btrim(p_gateway_order_id) = ''
     OR p_username IS NULL OR btrim(p_username) = ''
     OR p_amount IS NULL OR p_amount <= 0
     OR length(normalized_utr) < 10 OR length(normalized_utr) > 30 THEN
    RETURN jsonb_build_object('ok', FALSE, 'status', 'invalid_request');
  END IF;

  -- Serialize attempts using the same bank reference, including retries.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('jprime-utr:' || normalized_utr, 0)
  );

  SELECT *
  INTO deposit_row
  FROM public.deposit_history
  WHERE gateway_order_id::text = p_gateway_order_id
  FOR UPDATE;

  IF NOT FOUND OR deposit_row.username IS DISTINCT FROM p_username THEN
    RETURN jsonb_build_object('ok', FALSE, 'status', 'not_found');
  END IF;

  IF deposit_row.status = 'success' THEN
    RETURN jsonb_build_object('ok', FALSE, 'status', 'already_verified');
  END IF;

  IF deposit_row.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', FALSE, 'status', 'invalid_state');
  END IF;

  -- Legacy handler could mark a failed credit back to pending while retaining
  -- the verified UTR. The old credit may have committed before its response was
  -- lost, so never auto-credit such a legacy pending order a second time.
  IF length(regexp_replace(COALESCE(deposit_row.utr::text, ''), '[^0-9]', '', 'g')) BETWEEN 10 AND 30 THEN
    RETURN jsonb_build_object('ok', FALSE, 'status', 'manual_review');
  END IF;

  IF ABS(COALESCE(deposit_row.amount::numeric, 0) - p_amount) > 0.01 THEN
    RETURN jsonb_build_object('ok', FALSE, 'status', 'amount_mismatch');
  END IF;

  -- A normalized UTR may be settled only once across wallet deposits.
  SELECT EXISTS (
    SELECT 1
    FROM public.deposit_history d
    WHERE d.gateway_order_id::text <> p_gateway_order_id
      AND NULLIF(
        regexp_replace(COALESCE(d.utr::text, ''), '[^0-9]', '', 'g'),
        ''
      ) = normalized_utr
  ) INTO duplicate_utr;

  IF duplicate_utr THEN
    RETURN jsonb_build_object('ok', FALSE, 'status', 'duplicate_utr');
  END IF;

  -- payment_orders may differ on older installs; check its UTR column only if present.
  IF to_regclass('public.payment_orders') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'payment_orders'
         AND column_name = 'utr'
     ) THEN
    EXECUTE $query$
      SELECT EXISTS (
        SELECT 1
        FROM public.payment_orders po
        WHERE NULLIF(
          regexp_replace(COALESCE(po.utr::text, ''), '[^0-9]', '', 'g'),
          ''
        ) = $1
          AND po.gateway_order_id::text IS DISTINCT FROM $2
      )
    $query$
    INTO duplicate_utr
    USING normalized_utr, p_gateway_order_id;

    IF duplicate_utr THEN
      RETURN jsonb_build_object('ok', FALSE, 'status', 'duplicate_utr');
    END IF;
  END IF;

  -- This wallet credit is part of the same transaction as the order update below.
  credit_result := public.jprime_wallet_credit(p_username, ROUND(p_amount, 2));

  IF COALESCE((credit_result ->> 'ok')::boolean, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'Wallet credit RPC rejected verified deposit %', p_gateway_order_id;
  END IF;

  credited_balance := (credit_result ->> 'balance')::numeric;

  UPDATE public.deposit_history
  SET status = 'success',
      utr = normalized_utr
  WHERE gateway_order_id::text = p_gateway_order_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deposit status changed while finalizing order %', p_gateway_order_id;
  END IF;

  -- If the ledger insert fails, wallet credit and status update roll back as well.
  INSERT INTO public.wallet_transactions (
    username, type, amount, balance_after, description
  ) VALUES (
    p_username,
    'deposit',
    ROUND(p_amount, 2),
    credited_balance,
    'Wallet Deposit Verification Successful'
  );

  RETURN jsonb_build_object(
    'ok', TRUE,
    'status', 'success',
    'balance', credited_balance
  );
END
$function$;

REVOKE ALL ON FUNCTION public.jprime_finalize_wallet_deposit(TEXT, TEXT, TEXT, NUMERIC)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jprime_finalize_wallet_deposit(TEXT, TEXT, TEXT, NUMERIC)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
