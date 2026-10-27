-- ============================================================================
-- JPRIME  -  Payment gateway switch (xyz  <->  anuj)
-- Safe to run more than once. Nothing is dropped and no data is deleted.
-- Run in Supabase -> SQL Editor.
-- ============================================================================

-- 1) Settings table used by Admin -> Payments (server-only: no anon/authenticated access)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM anon, authenticated;

-- 2) Remember which gateway created each order (existing rows become 'xyz')
ALTER TABLE public.payment_orders  ADD COLUMN IF NOT EXISTS gateway text DEFAULT 'xyz';
ALTER TABLE public.deposit_history ADD COLUMN IF NOT EXISTS gateway text DEFAULT 'xyz';

UPDATE public.payment_orders  SET gateway = 'xyz' WHERE gateway IS NULL;
UPDATE public.deposit_history SET gateway = 'xyz' WHERE gateway IS NULL;

-- 3) Starting point: keep the current gateway active until you switch it in the admin page
INSERT INTO public.app_settings (key, value)
VALUES ('payment_gateway_active', '{"gateway":"xyz"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4) Check (read-only)
SELECT key, value->>'gateway' AS active_gateway, updated_at
FROM public.app_settings
WHERE key = 'payment_gateway_active';