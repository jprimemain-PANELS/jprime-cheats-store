-- Safe widening migration: preserves every existing password value as-is.
-- Required because modern password hashes are longer than VARCHAR(50).
ALTER TABLE public.users
  ALTER COLUMN password TYPE TEXT
  USING password::text;
