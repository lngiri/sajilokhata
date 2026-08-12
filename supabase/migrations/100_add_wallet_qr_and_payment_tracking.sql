-- 1. Add wallet QR to merchants (base64 stored in DB)
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS wallet_qr_base64 TEXT;

-- 2. Add payment tracking to credit_logs
ALTER TABLE credit_logs ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('cash', 'wallet', 'bank', 'other'));
ALTER TABLE credit_logs ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE credit_logs ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;

-- 3. Update status check constraint to include new payment statuses
-- First drop existing constraint if it exists
ALTER TABLE credit_logs DROP CONSTRAINT IF EXISTS credit_logs_status_check;

-- Add new constraint with all statuses
ALTER TABLE credit_logs ADD CONSTRAINT credit_logs_status_check 
  CHECK (status IN (
    'pending',
    'awaiting_confirmation', 
    'approved',
    'disputed',
    'rejected',
    'edit_requested',
    'unpaid',
    'partially_paid',
    'paid'
  ));

-- 4. Backfill: existing 'approved' entries where amount > 0 should be 'paid' with paid_amount = amount
UPDATE credit_logs 
SET 
  status = 'paid',
  paid_amount = amount,
  paid_at = approved_at
WHERE status = 'approved' 
  AND amount > 0 
  AND paid_amount = 0;

-- 5. Backfill: existing 'pending'/'awaiting_confirmation' with amount > 0 should be 'unpaid'
UPDATE credit_logs 
SET 
  status = 'unpaid',
  paid_amount = 0
WHERE status IN ('pending', 'awaiting_confirmation')
  AND amount > 0 
  AND paid_amount = 0;

-- 6. Index for payment queries
CREATE INDEX IF NOT EXISTS idx_credit_logs_merchant_paid ON credit_logs(merchant_id) 
  WHERE status IN ('unpaid', 'partially_paid');