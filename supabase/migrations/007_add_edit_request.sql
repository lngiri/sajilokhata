-- ============================================================
-- QR Hisab - Migration 007: Edit Request Workflow
-- ============================================================
-- Adds infrastructure for customer edit-request workflow:
--   1. proposed_amount column on credit_logs
--   2. 'edit_requested' status in the CHECK constraint
--   3. Rebuild customer_summary MV (same definition, new constraint)
-- ============================================================

-- 1. Add proposed_amount column
ALTER TABLE credit_logs
  ADD COLUMN IF NOT EXISTS proposed_amount NUMERIC;

-- 2. Add 'edit_requested' to the status CHECK constraint
ALTER TABLE credit_logs
  DROP CONSTRAINT IF EXISTS credit_logs_status_check;

ALTER TABLE credit_logs
  ADD CONSTRAINT credit_logs_status_check
  CHECK (status IN (
    'pending', 'unverified', 'approved',
    'disputed', 'rejected', 'edit_requested'
  ));

-- 3. Rebuild customer_summary MV (definition unchanged, just refreshed
--    so it reflects the new constraint/column)
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
