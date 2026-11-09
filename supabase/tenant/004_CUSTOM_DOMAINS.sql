-- =====================================================================
-- 004: CUSTOM DOMAINS  (ADDITIVE ONLY — adds optional columns, changes no existing data)
-- NOT RUN BY ME. Run after 001 and 003. Safe to run while the site is live.
--
-- What it does
--   1. tenants.custom_domain_allowed  (default false)  -> owner decides which stores may bring their own domain.
--   2. tenant_domains: kind ('subdomain' | 'custom'), dns_verified, verify_token, requested_at,
--      last_check_at, last_check_note, activated_at. Existing rows become kind='subdomain'.
--   A custom domain only serves a store when verified = true (set by the owner after DNS is proven
--   and the domain is added in Vercel). Nothing about your current domains changes.
-- =====================================================================
BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS custom_domain_allowed boolean NOT NULL DEFAULT false;

ALTER TABLE public.tenant_domains
  ADD COLUMN IF NOT EXISTS kind            text        NOT NULL DEFAULT 'subdomain',
  ADD COLUMN IF NOT EXISTS dns_verified    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verify_token    text,
  ADD COLUMN IF NOT EXISTS requested_at    timestamptz,
  ADD COLUMN IF NOT EXISTS last_check_at   timestamptz,
  ADD COLUMN IF NOT EXISTS last_check_note text,
  ADD COLUMN IF NOT EXISTS activated_at    timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_domains_kind_chk') THEN
    ALTER TABLE public.tenant_domains
      ADD CONSTRAINT tenant_domains_kind_chk CHECK (kind IN ('subdomain', 'custom'));
  END IF;
END $$;

-- at most ONE custom domain per store
CREATE UNIQUE INDEX IF NOT EXISTS tenant_domains_one_custom_uidx
  ON public.tenant_domains (tenant_id) WHERE kind = 'custom';

-- verification: the owner store's rows must be untouched
DO $$
BEGIN
  IF (SELECT count(*) FROM public.tenant_domains
        WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND verified = true) < 2 THEN
    RAISE EXCEPTION 'owner domains missing or changed — rolled back';
  END IF;
END $$;

COMMIT;
