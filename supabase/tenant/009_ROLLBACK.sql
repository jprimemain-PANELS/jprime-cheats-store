-- Rollback of 009. Stores launched as sub-stores lose their parent link (they keep running; payer wallet reverts to the main website).
DROP FUNCTION IF EXISTS public.jprime_tenant_subscribe_v2(uuid, text, text, numeric, int);
DROP INDEX IF EXISTS public.tenants_parent_idx;
ALTER TABLE public.tenants DROP COLUMN IF EXISTS parent_tenant_id;
