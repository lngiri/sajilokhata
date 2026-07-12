-- ============================================================
-- Sajilo Khata - Migration 003: Remove stale current_balance
-- ============================================================
-- The current_balance column on merchant_customers is no longer
-- the source of truth. Balance is computed dynamically from
-- approved credit_logs in application code.
--
-- Changes:
-- 1. Drop update_merchant_customer_balance trigger (redundant)
-- 2. Update check_credit_limit trigger to compute from logs
-- 3. Drop current_balance column
-- 4. Rebuild customer_summary MV without the stale column
-- ============================================================

-- 1. Drop the redundant balance trigger
DROP TRIGGER IF EXISTS trg_update_balance ON credit_logs;
DROP FUNCTION IF EXISTS update_merchant_customer_balance();

-- 2. Update credit limit check to compute balance from logs
CREATE OR REPLACE FUNCTION check_credit_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_limit NUMERIC;
  v_balance NUMERIC;
BEGIN
  IF NEW.type = 'debit' AND NEW.status = 'approved' THEN
    SELECT credit_limit INTO v_limit
    FROM merchant_customers
    WHERE merchant_id = NEW.merchant_id
      AND customer_id = NEW.customer_id;

    SELECT COALESCE(
      SUM(CASE WHEN type = 'debit' THEN amount ELSE -amount END), 0
    ) INTO v_balance
    FROM credit_logs
    WHERE merchant_id = NEW.merchant_id
      AND customer_id = NEW.customer_id
      AND status = 'approved'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');

    IF NEW.amount > (v_limit - v_balance) THEN
      RAISE EXCEPTION
        'Credit limit exceeded. Available credit: %, attempted: %',
        v_limit - v_balance, NEW.amount;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Remove the stale column
ALTER TABLE merchant_customers DROP COLUMN IF EXISTS current_balance;

-- 4. Rebuild materialized view without stale column
DROP MATERIALIZED VIEW IF EXISTS customer_summary;
CREATE MATERIALIZED VIEW customer_summary AS
SELECT
  mc.merchant_id,
  mc.customer_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  mc.credit_limit,
  COALESCE(
    SUM(CASE WHEN cl.status = 'approved' AND cl.type = 'debit' THEN cl.amount ELSE 0 END)
    -
    SUM(CASE WHEN cl.status = 'approved' AND cl.type = 'credit' THEN cl.amount ELSE 0 END),
    0
  ) AS current_balance,
  COUNT(CASE WHEN cl.status = 'pending' THEN 1 END) AS pending_entries,
  COUNT(CASE WHEN cl.status = 'approved' AND cl.type = 'debit' THEN 1 END)
    AS total_debit_entries,
  COUNT(CASE WHEN cl.status = 'approved' AND cl.type = 'credit' THEN 1 END)
    AS total_credit_entries,
  COALESCE(
    SUM(CASE WHEN cl.status = 'approved' AND cl.type = 'debit'
      THEN cl.amount ELSE 0 END), 0
  ) AS total_debit_amount,
  COALESCE(
    SUM(CASE WHEN cl.status = 'approved' AND cl.type = 'credit'
      THEN cl.amount ELSE 0 END), 0
  ) AS total_credit_amount,
  MAX(cl.created_at) AS last_transaction_at
FROM merchant_customers mc
JOIN customers c ON c.id = mc.customer_id
LEFT JOIN credit_logs cl
  ON cl.merchant_id = mc.merchant_id
  AND cl.customer_id = mc.customer_id
GROUP BY
  mc.merchant_id, mc.customer_id,
  c.name, c.phone,
  mc.credit_limit;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_summary
  ON customer_summary(merchant_id, customer_id);

-- 5. Remove merchant_customers from realtime (no longer has balance to track)
ALTER PUBLICATION supabase_realtime DROP TABLE merchant_customers;
