-- Migration 031: Add SMS balance to merchants + recharge logs table
-- Enables SMS credit management with transaction logging for live eSewa integration

ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS sms_balance INTEGER NOT NULL DEFAULT 50;

CREATE TABLE IF NOT EXISTS sms_recharge_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  sms_count INTEGER NOT NULL,
  transaction_uuid TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  esewa_ref_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_recharge_logs_merchant_id ON sms_recharge_logs(merchant_id);
CREATE INDEX IF NOT EXISTS idx_sms_recharge_logs_transaction_uuid ON sms_recharge_logs(transaction_uuid);
CREATE INDEX IF NOT EXISTS idx_sms_recharge_logs_esewa_ref_id ON sms_recharge_logs(esewa_ref_id);
