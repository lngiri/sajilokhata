-- Migration 030: Add initiated_by to credit_logs for voucher payment flow
-- Distinguishes customer-initiated entries (voucher upload) from merchant entries
ALTER TABLE credit_logs
ADD COLUMN IF NOT EXISTS initiated_by TEXT NOT NULL DEFAULT 'merchant' CHECK (initiated_by IN ('merchant', 'customer'));
