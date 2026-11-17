-- 008: allow the third seller "tahir seller" (SELLER3) in API SYSTEM.
-- Safe to run more than once. Back up first (Supabase > Database > Backups) as with every migration.
DO $$
DECLARE c text;
BEGIN
  IF to_regclass('public.tenant_api_connections') IS NULL THEN
    RAISE NOTICE 'tenant_api_connections not found: run 006_API_SYSTEM.sql first.';
    RETURN;
  END IF;
  FOR c IN
    SELECT con.conname FROM pg_constraint con
    WHERE con.conrelid = 'public.tenant_api_connections'::regclass AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%assigned_seller%'
  LOOP
    EXECUTE format('ALTER TABLE public.tenant_api_connections DROP CONSTRAINT %I', c);
  END LOOP;
  ALTER TABLE public.tenant_api_connections
    ADD CONSTRAINT tenant_api_connections_assigned_seller_check
    CHECK (assigned_seller IS NULL OR assigned_seller IN ('SELLER1', 'SELLER2', 'SELLER3'));
END $$;
