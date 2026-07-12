-- ============================================================
-- Sajilo Khata - Migration 006: Add verification token & dispute reason
-- ============================================================
-- Required by the WhatsApp remote-approve flow so that
-- unverified manual entries can be shared and verified by
-- customers without needing a full login session.

ALTER TABLE credit_logs ADD COLUMN IF NOT EXISTS verification_token UUID DEFAULT gen_random_uuid();
ALTER TABLE credit_logs ADD COLUMN IF NOT EXISTS disputed_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_credit_logs_verification_token ON credit_logs(verification_token);
