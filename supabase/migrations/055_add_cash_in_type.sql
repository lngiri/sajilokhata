-- ============================================================
-- Migration 055: Add 'cash_in' type to credit_logs
-- Purpose: Track money being added INTO the business (owner
--          injecting own/bank cash). Distinct from 'cash'
--          (cash sales) and 'expense' (money out).
--          Money coming IN, increases cash in hand.
-- ============================================================

-- Step 1: Widen the type CHECK constraint to accept 'cash_in'
ALTER TABLE credit_logs
  DROP CONSTRAINT IF EXISTS credit_logs_type_check;

ALTER TABLE credit_logs
  ADD CONSTRAINT credit_logs_type_check
  CHECK (type IN ('debit', 'credit', 'cash', 'expense', 'cash_in'));

-- Step 2: Add index for cash_in filtering
CREATE INDEX IF NOT EXISTS idx_credit_logs_type_cash_in
  ON credit_logs (merchant_id, status)
  WHERE type = 'cash_in';
