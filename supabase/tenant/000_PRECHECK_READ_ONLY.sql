-- 000: READ-ONLY pre-checks before the tenant migration. Changes nothing.
-- Run each block in the Supabase SQL editor and look at the results.

-- A. Exact duplicate usernames (blocks a unique (tenant_id, username) index; see 002).
SELECT username, count(*) AS accounts, string_agg(id, ', ') AS user_ids,
       string_agg(COALESCE(role, '(null)'), ', ') AS roles
FROM public.users GROUP BY username HAVING count(*) > 1 ORDER BY accounts DESC, username;

-- B. Wallet rows per username > 1 (merged lazily at runtime by the wallet functions).
SELECT username, count(*) AS wallet_rows, sum(balance) AS combined_balance
FROM public.wallets GROUP BY username HAVING count(*) > 1 ORDER BY wallet_rows DESC LIMIT 50;

-- C. deposit_history duplicates (block unique indexes in 002).
SELECT 'gateway_order_id' AS col, gateway_order_id AS val, count(*) FROM public.deposit_history
  WHERE gateway_order_id IS NOT NULL GROUP BY gateway_order_id HAVING count(*) > 1
UNION ALL
SELECT 'utr', utr, count(*) FROM public.deposit_history
  WHERE utr IS NOT NULL AND btrim(utr) <> '' GROUP BY utr HAVING count(*) > 1;

-- D. Baseline numbers to compare after the migration (001 also checks these itself).
SELECT 'users' t, count(*) FROM public.users UNION ALL
SELECT 'wallets', count(*) FROM public.wallets UNION ALL
SELECT 'wallet_transactions', count(*) FROM public.wallet_transactions UNION ALL
SELECT 'deposit_history', count(*) FROM public.deposit_history UNION ALL
SELECT 'payment_orders', count(*) FROM public.payment_orders UNION ALL
SELECT 'purchase_history', count(*) FROM public.purchase_history UNION ALL
SELECT 'stock_keys', count(*) FROM public.stock_keys UNION ALL
SELECT 'product_prices', count(*) FROM public.product_prices UNION ALL
SELECT 'products_catalog', count(*) FROM public.products_catalog UNION ALL
SELECT 'reseller_price_overrides', count(*) FROM public.reseller_price_overrides UNION ALL
SELECT 'TOTAL wallet balance', sum(balance) FROM public.wallets;
