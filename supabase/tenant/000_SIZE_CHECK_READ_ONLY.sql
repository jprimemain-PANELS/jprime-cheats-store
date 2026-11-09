-- READ ONLY. Changes nothing. Shows what uses your Supabase free storage (limit 500 MB).
-- Run it in Supabase > SQL Editor and send me the result if a table looks big.
SELECT pg_size_pretty(pg_database_size(current_database())) AS total_database_size;

SELECT relname AS table_name,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
       pg_total_relation_size(c.oid) AS bytes,
       c.reltuples::bigint AS approx_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 15;
