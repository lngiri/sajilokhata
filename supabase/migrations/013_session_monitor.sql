-- Migration 013: Session Monitor support
-- Adds force_logout_at column to merchants for admin force-logout capability
-- Also creates session_log table for tracking active sessions

-- Add force_logout_at to merchants (idempotent)
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS force_logout_at TIMESTAMPTZ DEFAULT NULL;

-- Index for session monitor queries
CREATE INDEX IF NOT EXISTS idx_merchants_phone_lookup ON merchants (phone);
CREATE INDEX IF NOT EXISTS idx_merchants_name_lookup ON merchants (name);
