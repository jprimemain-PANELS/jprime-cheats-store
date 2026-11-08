-- =====================================================================================
-- JPRIME STORE - stock diagnostics. READ-ONLY (SELECT only). Nothing here changes data.
-- Your stock_keys.is_used column is stored as TEXT (not true/false), so every query below
-- compares it as text.
-- =====================================================================================

-- 1) What values does is_used hold? Expected: 'false' (unused) and 'true' (sold).
--    Anything else (empty, NULL, 'FALSE', '0', 'f') is NOT counted as unused by the website.
select is_used, count(*) as keys
from public.stock_keys
group by is_used
order by keys desc;

-- 2) Unused keys whose product + duration match NO catalogue product/duration.
--    (Compares ignoring letter case, extra spaces and styled letters like 𝗣𝗛𝗔𝗡𝗧𝗢𝗠 via NFKC.)
with catalog as (
  select normalize(lower(regexp_replace(btrim(c.name), '\s+', ' ', 'g')), NFKC)               as p,
         normalize(lower(regexp_replace(btrim(t->>'duration'), '\s+', ' ', 'g')), NFKC)       as d
  from public.products_catalog c,
       jsonb_array_elements(coalesce(c.data::jsonb->'prices', '[]'::jsonb)) t
)
select s.product_name, s.duration, count(*) as unused_keys
from public.stock_keys s
where s.is_used::text = 'false'
  and not exists (
    select 1 from catalog k
    where k.p = normalize(lower(regexp_replace(btrim(s.product_name), '\s+', ' ', 'g')), NFKC)
      and k.d = normalize(lower(regexp_replace(btrim(s.duration),     '\s+', ' ', 'g')), NFKC)
  )
group by s.product_name, s.duration
order by s.product_name, s.duration;

-- 3) All catalogue product names with their durations (to compare with the list above).
select c.name,
       string_agg(t->>'duration', ' | ' order by ord) as durations
from public.products_catalog c,
     jsonb_array_elements(coalesce(c.data::jsonb->'prices', '[]'::jsonb)) with ordinality as x(t, ord)
group by c.name
order by c.name;
