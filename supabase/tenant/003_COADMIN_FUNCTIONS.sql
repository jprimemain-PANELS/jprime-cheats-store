-- =====================================================================
-- 003: CO-ADMIN FUNCTIONS (approve / reject / suspend / direct-create / stats)
-- ADDITIVE ONLY. NOT RUN BY ME. Run AFTER 001. Safe to run twice.
--
-- Why SQL functions: approving a co-admin must create the store, its login, its
-- domain and its settings TOGETHER or not at all. One function = one transaction,
-- so a half-created store can never exist.
-- All functions are callable only by the server (service_role).
-- =====================================================================
BEGIN;

-- ---------- slug rules (the app checks the same list; this is the safety net) ----------
CREATE OR REPLACE FUNCTION public.jprime_slug_is_valid(p_slug text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_slug ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'
     AND p_slug !~ '--'
     AND p_slug NOT IN ('jprime','www','api','app','admin','administrator','root','store','shop','login','signup',
                        'register','support','help','mail','email','ftp','smtp','dashboard','owner','platform',
                        'static','assets','cdn','status','blog','test','demo','staging','dev','preview','billing',
                        'payment','payments','secure','account','accounts','auth','wallet','panel','cheats')
$$;

CREATE OR REPLACE FUNCTION public.jprime_slug_available(p_slug text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT public.jprime_slug_is_valid(p_slug)
     AND NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.slug = p_slug)
     AND NOT EXISTS (SELECT 1 FROM public.tenant_applications a WHERE a.slug = p_slug AND a.status IN ('pending', 'approved'))
$$;

-- ---------- approve an application: tenant + co-admin login + domain + settings + audit ----------
CREATE OR REPLACE FUNCTION public.jprime_approve_tenant_application(
  p_app_id uuid, p_actor_id text, p_actor_name text, p_root_domain text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  app public.tenant_applications%ROWTYPE;
  new_tenant uuid;
  new_user text;
  v_host text;
  root text := lower(btrim(COALESCE(p_root_domain, '')));
BEGIN
  SELECT * INTO app FROM public.tenant_applications WHERE id = p_app_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF app.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_pending'); END IF;

  IF NOT public.jprime_slug_is_valid(app.slug) THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_slug'); END IF;
  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = app.slug) THEN RETURN jsonb_build_object('ok', false, 'reason', 'slug_taken'); END IF;
  IF app.coadmin_username !~ '^[A-Za-z0-9_.-]{3,32}$' THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_username'); END IF;
  IF app.coadmin_password_hash IS NULL OR app.coadmin_password_hash NOT LIKE 'scrypt$%' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_password_hash');
  END IF;
  IF root <> '' AND root !~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_root_domain');
  END IF;

  INSERT INTO public.tenants (slug, kind, status, brand_name, telegram_username, inventory_mode, approved_at)
  VALUES (app.slug, 'coadmin', 'active', app.brand_name, app.telegram_username, app.inventory_mode, now())
  RETURNING id INTO new_tenant;

  INSERT INTO public.users (tenant_id, username, password, email, mobile_number, role, created_at)
  VALUES (new_tenant, app.coadmin_username, app.coadmin_password_hash, COALESCE(app.contact_email, ''),
          COALESCE(app.contact_phone, ''), 'coadmin', now()::text)
  RETURNING id INTO new_user;

  UPDATE public.tenants SET coadmin_user_id = new_user, updated_at = now() WHERE id = new_tenant;

  INSERT INTO public.tenant_settings (tenant_id, theme) VALUES (new_tenant, '{}'::jsonb);

  IF root <> '' THEN
    v_host := app.slug || '.' || root;
    INSERT INTO public.tenant_domains (host, tenant_id, is_primary, verified) VALUES (v_host, new_tenant, true, true);
  END IF;

  UPDATE public.tenant_applications
     SET status = 'approved', reviewed_by = p_actor_id, reviewed_at = now()
   WHERE id = p_app_id;

  INSERT INTO public.audit_log (tenant_id, actor_user_id, actor_username, action, target, meta)
  VALUES (new_tenant, p_actor_id, p_actor_name, 'tenant.approve', app.slug,
          jsonb_build_object('application', p_app_id, 'host', v_host, 'inventory_mode', app.inventory_mode));

  RETURN jsonb_build_object('ok', true, 'tenant_id', new_tenant, 'host', v_host);
END $function$;

-- ---------- reject ----------
CREATE OR REPLACE FUNCTION public.jprime_reject_tenant_application(
  p_app_id uuid, p_actor_id text, p_actor_name text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE app public.tenant_applications%ROWTYPE;
BEGIN
  SELECT * INTO app FROM public.tenant_applications WHERE id = p_app_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF app.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_pending'); END IF;
  UPDATE public.tenant_applications
     SET status = 'rejected', reviewed_by = p_actor_id, reviewed_at = now(), review_note = left(p_note, 300)
   WHERE id = p_app_id;
  INSERT INTO public.audit_log (actor_user_id, actor_username, action, target, reason, meta)
  VALUES (p_actor_id, p_actor_name, 'tenant.reject', app.slug, left(p_note, 300), jsonb_build_object('application', p_app_id));
  RETURN jsonb_build_object('ok', true);
END $function$;

-- ---------- suspend / reactivate (the OWNER tenant can never be touched) ----------
CREATE OR REPLACE FUNCTION public.jprime_set_tenant_status(
  p_tenant uuid, p_status text, p_actor_id text, p_actor_name text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE t public.tenants%ROWTYPE;
BEGIN
  IF p_status NOT IN ('active', 'suspended') THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status'); END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RETURN jsonb_build_object('ok', false, 'reason', 'reason_required'); END IF;
  SELECT * INTO t FROM public.tenants WHERE id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF t.kind = 'owner' THEN RETURN jsonb_build_object('ok', false, 'reason', 'owner_protected'); END IF;
  IF t.status NOT IN ('active', 'suspended') THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_state'); END IF;
  IF t.status = p_status THEN RETURN jsonb_build_object('ok', true, 'unchanged', true); END IF;

  UPDATE public.tenants
     SET status = p_status, updated_at = now(),
         suspended_at = CASE WHEN p_status = 'suspended' THEN now() ELSE NULL END
   WHERE id = p_tenant;
  INSERT INTO public.audit_log (tenant_id, actor_user_id, actor_username, action, target, reason)
  VALUES (p_tenant, p_actor_id, p_actor_name,
          CASE WHEN p_status = 'suspended' THEN 'tenant.suspend' ELSE 'tenant.reactivate' END, t.slug, left(p_reason, 300));
  RETURN jsonb_build_object('ok', true);
END $function$;

-- ---------- owner creates a co-admin directly (application + approval in ONE transaction) ----------
CREATE OR REPLACE FUNCTION public.jprime_create_tenant_direct(
  p_brand text, p_slug text, p_telegram text, p_inventory text,
  p_username text, p_password_hash text, p_email text, p_phone text,
  p_actor_id text, p_actor_name text, p_root_domain text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE app_id uuid; res jsonb;
BEGIN
  IF NOT public.jprime_slug_available(p_slug) THEN RETURN jsonb_build_object('ok', false, 'reason', 'slug_unavailable'); END IF;
  INSERT INTO public.tenant_applications (applicant_user_id, applicant_tenant_id, brand_name, slug, telegram_username,
         inventory_mode, contact_email, contact_phone, coadmin_username, coadmin_password_hash)
  VALUES (p_actor_id, '00000000-0000-0000-0000-000000000001', p_brand, p_slug, p_telegram,
          COALESCE(p_inventory, 'own_api'), p_email, p_phone, p_username, p_password_hash)
  RETURNING id INTO app_id;
  res := public.jprime_approve_tenant_application(app_id, p_actor_id, p_actor_name, p_root_domain);
  IF COALESCE((res ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'direct create failed: %', res ->> 'reason';   -- rolls back the inserted application too
  END IF;
  RETURN res;
END $function$;

-- ---------- per-store numbers for the owner dashboard ----------
CREATE OR REPLACE FUNCTION public.jprime_tenant_stats()
RETURNS TABLE (tenant_id uuid, customers bigint, resellers bigint, products bigint, orders bigint,
               wallet_total numeric, last_purchase_at text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT t.id,
    (SELECT count(*) FROM public.users u WHERE u.tenant_id = t.id AND COALESCE(u.role, 'user') = 'user'),
    (SELECT count(*) FROM public.users u WHERE u.tenant_id = t.id AND u.role = 'reseller'),
    (SELECT count(*) FROM public.products_catalog p WHERE p.tenant_id = t.id),
    (SELECT count(*) FROM public.purchase_history h WHERE h.tenant_id = t.id),
    (SELECT COALESCE(sum(w.balance), 0) FROM public.wallets w WHERE w.tenant_id = t.id),
    (SELECT max(h.created_at) FROM public.purchase_history h WHERE h.tenant_id = t.id)
  FROM public.tenants t
$$;

-- ---------- permissions: server only ----------
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'jprime_slug_is_valid(text)', 'jprime_slug_available(text)',
    'jprime_approve_tenant_application(uuid,text,text,text)', 'jprime_reject_tenant_application(uuid,text,text,text)',
    'jprime_set_tenant_status(uuid,text,text,text,text)',
    'jprime_create_tenant_direct(text,text,text,text,text,text,text,text,text,text,text)', 'jprime_tenant_stats()']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- VERIFY (read-only):
-- SELECT public.jprime_slug_available('andrews');           -- true if free
-- SELECT * FROM public.jprime_tenant_stats();                -- one row per store
