-- =====================================================================
-- 005: STORE SUBSCRIPTIONS  (ADDITIVE ONLY — adds optional columns + 2 functions, changes no existing data)
-- NOT RUN BY ME. Run after 001 and 003 (backup first). Safe while the site is live.
--
-- Rules (the SERVER decides prices, the browser can never set them):
--   weekly    Rs 90   -> 7 days
--   monthly   Rs 249  -> 30 days
--   quarterly Rs 695  -> 90 days   (3 x 249 = 747, minus 7% = 694.71, rounded to 695)
-- Money is taken from the reseller's wallet on the OWNER store, in one all-or-nothing step.
-- A store with plan_expires_at = NULL (every store that exists today) NEVER expires.
-- No new tables: payment history lives in the existing audit_log (action 'sub.pay').
-- =====================================================================
BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_used      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payer_username  text,
  ADD COLUMN IF NOT EXISTS self_service    boolean NOT NULL DEFAULT false;

-- start the free trial for a store (once only)
CREATE OR REPLACE FUNCTION public.jprime_tenant_start_trial(p_tenant uuid, p_payer text, p_days int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE t public.tenants%ROWTYPE;
BEGIN
  IF p_days IS NULL OR p_days < 1 OR p_days > 30 OR p_payer IS NULL OR btrim(p_payer) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  SELECT * INTO t FROM public.tenants WHERE id = p_tenant FOR UPDATE;
  IF NOT FOUND OR t.kind <> 'coadmin' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF t.trial_used THEN RETURN jsonb_build_object('ok', false, 'reason', 'trial_used'); END IF;
  UPDATE public.tenants
     SET trial_used = true, self_service = true, payer_username = p_payer,
         plan_expires_at = now() + make_interval(days => p_days), updated_at = now()
   WHERE id = p_tenant;
  INSERT INTO public.audit_log (tenant_id, actor_user_id, actor_username, action, target, meta)
  VALUES (p_tenant, 'self-service', p_payer, 'sub.trial', p_tenant::text, jsonb_build_object('days', p_days));
  RETURN jsonb_build_object('ok', true, 'expires_at', now() + make_interval(days => p_days));
END $function$;

-- buy a plan from the wallet (atomic: either wallet is charged AND time is added, or nothing happens)
CREATE OR REPLACE FUNCTION public.jprime_tenant_subscribe(p_tenant uuid, p_plan text, p_actor text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  t public.tenants%ROWTYPE;
  v_price numeric; v_days int; deb jsonb; v_new timestamptz;
  OWNER constant uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  v_price := CASE p_plan WHEN 'weekly' THEN 90 WHEN 'monthly' THEN 249 WHEN 'quarterly' THEN 695 END;
  v_days  := CASE p_plan WHEN 'weekly' THEN 7  WHEN 'monthly' THEN 30  WHEN 'quarterly' THEN 90  END;
  IF v_price IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_plan'); END IF;

  SELECT * INTO t FROM public.tenants WHERE id = p_tenant FOR UPDATE;
  IF NOT FOUND OR t.kind <> 'coadmin' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF t.status NOT IN ('active', 'suspended') THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_active'); END IF;
  IF t.payer_username IS NULL OR btrim(t.payer_username) = '' THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_payer'); END IF;

  deb := public.jprime_t_wallet_debit(OWNER, t.payer_username, v_price);
  IF COALESCE((deb ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', COALESCE(deb ->> 'reason', 'payment_failed'),
                              'balance', COALESCE((deb ->> 'balance')::numeric, 0), 'price', v_price);
  END IF;

  v_new := GREATEST(COALESCE(t.plan_expires_at, now()), now()) + make_interval(days => v_days);
  UPDATE public.tenants SET plan_expires_at = v_new, updated_at = now() WHERE id = p_tenant;

  INSERT INTO public.audit_log (tenant_id, actor_user_id, actor_username, action, target, meta)
  VALUES (p_tenant, COALESCE(p_actor, ''), COALESCE(p_actor, ''), 'sub.pay', p_plan,
          jsonb_build_object('price', v_price, 'days', v_days, 'payer', t.payer_username));
  RETURN jsonb_build_object('ok', true, 'expires_at', v_new, 'price', v_price, 'balance', (deb ->> 'balance')::numeric);
END $function$;

REVOKE ALL ON FUNCTION public.jprime_tenant_start_trial(uuid, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jprime_tenant_subscribe(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jprime_tenant_start_trial(uuid, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.jprime_tenant_subscribe(uuid, text, text) TO service_role;

COMMIT;
