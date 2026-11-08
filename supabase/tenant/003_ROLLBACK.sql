-- Rollback for 003_COADMIN_FUNCTIONS.sql. Safe: it only drops the helper functions.
-- It does NOT touch any tenant, user, wallet or application data.
BEGIN;
DROP FUNCTION IF EXISTS public.jprime_tenant_stats();
DROP FUNCTION IF EXISTS public.jprime_create_tenant_direct(text,text,text,text,text,text,text,text,text,text,text);
DROP FUNCTION IF EXISTS public.jprime_set_tenant_status(uuid,text,text,text,text);
DROP FUNCTION IF EXISTS public.jprime_reject_tenant_application(uuid,text,text,text);
DROP FUNCTION IF EXISTS public.jprime_approve_tenant_application(uuid,text,text,text);
DROP FUNCTION IF EXISTS public.jprime_slug_available(text);
DROP FUNCTION IF EXISTS public.jprime_slug_is_valid(text);
COMMIT;
