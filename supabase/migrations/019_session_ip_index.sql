-- Migration 019: Add ip_address to sessions for admin session monitor
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address TEXT DEFAULT '';

-- Index for session monitor: lookup by merchant_id
CREATE INDEX IF NOT EXISTS idx_sessions_merchant_id ON sessions (merchant_id);
