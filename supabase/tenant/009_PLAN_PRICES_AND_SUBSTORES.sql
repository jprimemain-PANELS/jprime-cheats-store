-- =====================================================================
-- 009: EDITABLE PLAN PRICES + SUB-STORES  (ADDITIVE ONLY)
-- Run after 005 (backup first). Safe while the site is live; changes no existing data or function.
--   * tenants.parent_tenant_id : a store launched by a reseller of another co-admin store points to that store.
--     NULL (every store today) = paid on the main website, exactly as before.
--   * jprime_tenant_subscribe_v2 : same all-or-nothing payment as v1, but the SERVER passes the price/days
--     (the owner or the parent co-admin edits them) and the wallet is the one on the PARENT store (or the owner store).
-- The old jprime_tenant_subscribe stays in place (nothing breaks if you roll back).
-- =====================================================================
BEGIN;

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS parent_tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS tenants_parent_idx ON public.tenants (parent_tenant_id) WHERE parent_tenant_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.jprime_tenant_subscribe_v2(p_tenant uuid, p_plan text, p_actor text, p_price numeric, p_days int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  t public.tenants%ROWTYPE;
  deb jsonb; v_new timestamptz; v_wallet uuid;
  OWNER constant uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  IF p_plan NOT IN ('weekly', 'monthly', 'quarterly') OR p_price IS NULL OR p_price < 1 OR p_price > 100000
     OR p_days IS NULL OR p_days < 1 OR p_days > 366 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_plan');
  END IF;

  SELECT * INTO t FROM public.tenants WHERE id = p_tenant FOR UPDATE;
  IF NOT FOUND OR t.kind <> 'coadmin' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF t.status NOT IN ('active', 'suspended') THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_active'); END IF;
  IF t.payer_username IS NULL OR btrim(t.payer_username) = '' THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_payer'); END IF;

  v_wallet := COALESCE(t.parent_tenant_id, OWNER);
  deb := public.jprime_t_wallet_debit(v_wallet, t.payer_username, p_price);
  IF COALESCE((deb ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', COALESCE(deb ->> 'reason', 'payment_failed'),
                              'balance', COALESCE((deb ->> 'balance')::numeric, 0), 'price', p_price);
  END IF;

  v_new := GREATEST(COALESCE(t.plan_expires_at, now()), now()) + make_interval(days => p_days);
  UPDATE public.tenants SET plan_expires_at = v_new, updated_at = now() WHERE id = p_tenant;

  INSERT INTO public.audit_log (tenant_id, actor_user_id, actor_username, action, target, meta)
  VALUES (p_tenant, COALESCE(p_actor, ''), COALESCE(p_actor, ''), 'sub.pay', p_plan,
          jsonb_build_object('price', p_price, 'days', p_days, 'payer', t.payer_username, 'wallet_store', v_wallet));
  RETURN jsonb_build_object('ok', true, 'expires_at', v_new, 'price', p_price, 'balance', (deb ->> 'balance')::numeric);
END $function$;

REVOKE ALL ON FUNCTION public.jprime_tenant_subscribe_v2(uuid, text, text, numeric, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jprime_tenant_subscribe_v2(uuid, text, text, numeric, int) TO service_role;

COMMIT;
