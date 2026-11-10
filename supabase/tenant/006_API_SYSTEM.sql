-- =====================================================================
-- 006: API SYSTEM  (ADDITIVE ONLY — one new small table, nothing existing is touched)
-- NOT RUN BY ME. Run after 001. Safe while the site is live. Back up first.
--
-- tenant_api_connections: what a co-admin asks for / uses on the "API SYSTEM" page.
--   kind        own_api      = "my own API"            (you develop it, then mark it ready)
--               other_seller = "another seller's API"  (or one of YOUR sellers: you pick which and approve)
--   status      pending -> in_development | approved | rejected
--   assigned_seller  SELLER1 (bb team admin) / SELLER2 (whitex seller hub): which of YOUR integrations it uses
-- Keys are stored for the owner to use; they are never sent back to a browser (only a masked hint).
-- Size is capped (notes 8000 chars, keys 500) so this can never grow big on the free plan.
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.tenant_api_connections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN ('own_api', 'other_seller')),
  seller_name      text NOT NULL CHECK (char_length(seller_name) BETWEEN 2 AND 60),
  endpoint_url     text CHECK (endpoint_url IS NULL OR char_length(endpoint_url) <= 300),
  api_key          text CHECK (api_key IS NULL OR char_length(api_key) <= 500),
  master_key       text CHECK (master_key IS NULL OR char_length(master_key) <= 500),
  notes            text CHECK (notes IS NULL OR char_length(notes) <= 8000),
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_development', 'approved', 'rejected')),
  assigned_seller  text CHECK (assigned_seller IS NULL OR assigned_seller IN ('SELLER1', 'SELLER2')),
  owner_note       text CHECK (owner_note IS NULL OR char_length(owner_note) <= 500),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  decided_at       timestamptz
);

CREATE INDEX IF NOT EXISTS tenant_api_connections_tenant_idx ON public.tenant_api_connections (tenant_id, status);
-- a store can have each of your sellers approved only once
CREATE UNIQUE INDEX IF NOT EXISTS tenant_api_connections_one_seller_uidx
  ON public.tenant_api_connections (tenant_id, assigned_seller) WHERE status = 'approved' AND assigned_seller IS NOT NULL;

ALTER TABLE public.tenant_api_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_api_connections FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.tenant_api_connections TO service_role;

COMMIT;
