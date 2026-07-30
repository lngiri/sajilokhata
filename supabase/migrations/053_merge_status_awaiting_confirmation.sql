-- Migration 053: Merge 'unverified' and 'pending' into 'awaiting_confirmation'
-- Both statuses represented entries awaiting confirmation from the counterparty.
-- 'unverified' = merchant-initiated, customer needs to confirm
-- 'pending' = customer-initiated, merchant needs to confirm
-- Now unified as 'awaiting_confirmation' with initiated_by distinguishing direction.

-- 1. Migrate existing data
UPDATE credit_logs SET status = 'awaiting_confirmation' WHERE status = 'unverified';
UPDATE credit_logs SET status = 'awaiting_confirmation' WHERE status = 'pending';

-- 2. Drop old constraint and add new one
ALTER TABLE credit_logs DROP CONSTRAINT IF EXISTS credit_logs_status_check;
ALTER TABLE credit_logs ADD CONSTRAINT credit_logs_status_check
  CHECK (status IN ('awaiting_confirmation', 'approved', 'disputed', 'rejected', 'edit_requested'));
