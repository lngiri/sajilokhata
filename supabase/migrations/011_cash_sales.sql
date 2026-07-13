-- ============================================================
-- Cash Sales Support (नगद बिक्री)
-- Changes:
--   1. Add 'cash' to credit_logs.type CHECK constraint
--   2. Make credit_logs.customer_id nullable (walk-in anonymous)
--   3. Add index on type for fast cash-sales filtering
-- ============================================================

-- Step 1: Widen the type CHECK constraint to accept 'cash'
ALTER TABLE credit_logs
  DROP CONSTRAINT IF EXISTS credit_logs_type_check;

ALTER TABLE credit_logs
  ADD CONSTRAINT credit_logs_type_check
  CHECK (type IN ('debit', 'credit', 'cash'));

-- Step 2: Allow customer_id to be NULL (anonymous cash sales)
ALTER TABLE credit_logs
  ALTER COLUMN customer_id DROP NOT NULL;

-- Step 3: Index for fast cash-sales queries
CREATE INDEX idx_credit_logs_type ON credit_logs(type);
