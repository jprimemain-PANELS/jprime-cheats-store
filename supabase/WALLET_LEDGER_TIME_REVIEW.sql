-- =====================================================================================
-- Wallet history times. FOR REVIEW ONLY: NOTHING HERE HAS BEEN EXECUTED.
-- Your ledger showed "01 Jan 1970" for old wallet rows: those rows were saved with NO time,
-- so the admin ledger can only fill it in from purchase history / top-up history.
-- =====================================================================================

-- 1) READ-ONLY: how many wallet rows have no time, and how is the column defined?
select count(*) filter (where created_at is null) as rows_without_time,
       count(*)                                   as total_rows
from public.wallet_transactions;

select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'wallet_transactions'
order by ordinal_position;

-- 2) OPTIONAL FIX FOR NEW ROWS ONLY (does not change any existing row):
--    every future wallet row gets the time it was written.
-- alter table public.wallet_transactions alter column created_at set default now();
