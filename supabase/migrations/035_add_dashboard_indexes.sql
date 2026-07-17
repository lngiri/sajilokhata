-- Migration 035: Add indexes for dashboard performance
-- Speeds up the common dashboard queries for Recent Activity and Session Monitor.

-- credit_logs: merchant + created_at (no status filter) — used by "Recent Activity" widget
CREATE INDEX IF NOT EXISTS idx_credit_logs_merchant_created
  ON credit_logs(merchant_id, created_at DESC);

-- sessions: merchant + last_active — used by admin Session Monitor
CREATE INDEX IF NOT EXISTS idx_sessions_merchant_last_active
  ON sessions(merchant_id, last_active);

-- Cleanup: idx_sessions_merchant_id duplicates idx_sessions_merchant (both single-column on merchant_id)
DROP INDEX IF EXISTS idx_sessions_merchant_id;
