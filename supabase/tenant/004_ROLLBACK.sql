-- Rollback for 004. Only run if NO store uses a custom domain yet (it drops the extra columns).
BEGIN;
DROP INDEX IF EXISTS public.tenant_domains_one_custom_uidx;
ALTER TABLE public.tenant_domains DROP CONSTRAINT IF EXISTS tenant_domains_kind_chk;
ALTER TABLE public.tenant_domains
  DROP COLUMN IF EXISTS kind, DROP COLUMN IF EXISTS dns_verified, DROP COLUMN IF EXISTS verify_token,
  DROP COLUMN IF EXISTS requested_at, DROP COLUMN IF EXISTS last_check_at, DROP COLUMN IF EXISTS last_check_note,
  DROP COLUMN IF EXISTS activated_at;
ALTER TABLE public.tenants DROP COLUMN IF EXISTS custom_domain_allowed;
COMMIT;
