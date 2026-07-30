-- ============================================================
-- Migration 054: Add 'expense' type to credit_logs
-- Purpose: Track business expenses (purchases, rent, transport, etc.)
--          Money going OUT of the business, reducing cash in hand.
-- ============================================================

-- Step 1: Widen the type CHECK constraint to accept 'expense'
ALTER TABLE credit_logs
  DROP CONSTRAINT IF EXISTS credit_logs_type_check;

ALTER TABLE credit_logs
  ADD CONSTRAINT credit_logs_type_check
  CHECK (type IN ('debit', 'credit', 'cash', 'expense'));

-- Step 2: Add index for expense filtering
CREATE INDEX IF NOT EXISTS idx_credit_logs_type_expense
  ON credit_logs (merchant_id, status)
  WHERE type = 'expense';
