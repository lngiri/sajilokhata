-- ============================================================
-- Sajilo Khata - Migration 005: Add 'unverified' status
-- ============================================================
-- Required by the manual merchant entry flow so that entries
-- created by merchants appear as "Unverified" on the customer
-- side until the customer confirms or disputes them.

-- Drop existing check constraint
ALTER TABLE credit_logs DROP CONSTRAINT IF EXISTS credit_logs_status_check;

-- Re-add with 'unverified' included
ALTER TABLE credit_logs ADD CONSTRAINT credit_logs_status_check
  CHECK (status IN ('pending', 'unverified', 'approved', 'disputed', 'rejected'));
