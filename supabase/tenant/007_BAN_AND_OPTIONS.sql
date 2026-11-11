-- 007: ban flag for stores. Additive and safe to run twice. (Store options/settings use the existing app_settings table.)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false;
