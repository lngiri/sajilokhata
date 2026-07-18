-- Migration 043: Idempotency keys for financial ledger and SMS transactions
-- Prevents duplicate entries due to network retries in poor connectivity

-- credit_logs: merchants generate a unique key per transaction request
ALTER TABLE public.credit_logs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE INDEX IF NOT EXISTS idx_credit_logs_idempotency ON public.credit_logs (merchant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- sms_requests: unique key per SMS send request
ALTER TABLE public.sms_requests ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE INDEX IF NOT EXISTS idx_sms_requests_idempotency ON public.sms_requests (merchant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
