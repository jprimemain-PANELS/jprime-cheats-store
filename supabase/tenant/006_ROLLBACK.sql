-- Rollback for 006. Drops only the API SYSTEM table (stores using their own seller keys stop being able to buy from them).
BEGIN;
DROP TABLE IF EXISTS public.tenant_api_connections;
COMMIT;
