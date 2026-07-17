-- Migration 038: Additional performance indexes for aggregation queries
-- Speeds up merchant dashboard stats and report card aggregations.

-- Composite index for the common aggregation pattern in getMerchantStats:
-- WHERE merchant_id = ? AND status = 'approved' — grouped by type, summed by amount
CREATE INDEX IF NOT EXISTS idx_credit_logs_stats_agg
  ON credit_logs(merchant_id, status, type, amount);

-- Index for today's date-range filtering on approved logs
CREATE INDEX IF NOT EXISTS idx_credit_logs_merchant_status_created_type
  ON credit_logs(merchant_id, status, created_at DESC, type);

-- Index for merchant_customers credit_limit lookups (getMerchantStats)
CREATE INDEX IF NOT EXISTS idx_merchant_customers_merchant_credit
  ON merchant_customers(merchant_id, credit_limit);

-- Index for pending-count queries
CREATE INDEX IF NOT EXISTS idx_credit_logs_merchant_status_id
  ON credit_logs(merchant_id, status, id);
