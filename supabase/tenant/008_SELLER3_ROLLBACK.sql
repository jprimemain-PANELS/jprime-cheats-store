-- Rollback of 008. Fails if a store is already assigned SELLER3 (move it first).
ALTER TABLE public.tenant_api_connections DROP CONSTRAINT IF EXISTS tenant_api_connections_assigned_seller_check;
ALTER TABLE public.tenant_api_connections
  ADD CONSTRAINT tenant_api_connections_assigned_seller_check
  CHECK (assigned_seller IS NULL OR assigned_seller IN ('SELLER1', 'SELLER2'));
