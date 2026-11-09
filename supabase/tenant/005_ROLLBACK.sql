-- Rollback for 005. Stores keep working; subscriptions simply stop. Run only if you must.
BEGIN;
DROP FUNCTION IF EXISTS public.jprime_tenant_subscribe(uuid, text, text);
DROP FUNCTION IF EXISTS public.jprime_tenant_start_trial(uuid, text, int);
ALTER TABLE public.tenants
  DROP COLUMN IF EXISTS plan_expires_at, DROP COLUMN IF EXISTS trial_used,
  DROP COLUMN IF EXISTS payer_username, DROP COLUMN IF EXISTS self_service;
COMMIT;
