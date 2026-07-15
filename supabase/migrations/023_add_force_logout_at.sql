-- Migration 023: Add force_logout_at column to merchants
-- This column was originally in 013_session_monitor.sql but may have been
-- skipped if migrations were not applied sequentially. Standalone for safety.
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS force_logout_at TIMESTAMPTZ DEFAULT NULL;
