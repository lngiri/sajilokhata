-- ============================================================
-- Customer Trust Status — flag customers as warning/defaulter
-- with full audit trail and privacy guardrails.
--
-- trust_status values:
--   'good'      — normal customer (default)
--   'warning'   — flagged for late payments / suspicious activity
--   'defaulter' — flagged as defaulter
--
-- flagged_by_merchant_id is NEVER exposed to other merchants
-- for privacy. Only the flagging merchant can clear the flag.
-- ============================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS trust_status TEXT NOT NULL DEFAULT 'good'
    CHECK (trust_status IN ('good', 'warning', 'defaulter')),
  ADD COLUMN IF NOT EXISTS trust_notes TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS flagged_by_merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_flagged_by
  ON customers(flagged_by_merchant_id);
