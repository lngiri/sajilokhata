-- ============================================================
-- QR Hisab - Migration 002: Fix trigger logic & constraints
-- ============================================================
-- 1. Fix update_merchant_customer_balance: reverse balance when
--    status changes FROM 'approved' to 'disputed'/'rejected'
-- 2. Fix check_credit_limit: fire on INSERT too (not just UPDATE)
-- ============================================================

-- Fix 1: Reverse balance on status change away from 'approved'
CREATE OR REPLACE FUNCTION update_merchant_customer_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Adding to balance (status changed TO approved)
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') THEN
    IF NEW.type = 'debit' THEN
      UPDATE merchant_customers
      SET current_balance = current_balance + NEW.amount,
          updated_at = now()
      WHERE merchant_id = NEW.merchant_id
        AND customer_id = NEW.customer_id;
    ELSIF NEW.type = 'credit' THEN
      UPDATE merchant_customers
      SET current_balance = current_balance - NEW.amount,
          updated_at = now()
      WHERE merchant_id = NEW.merchant_id
        AND customer_id = NEW.customer_id;
    END IF;
  END IF;

  -- Reversing from balance (status changed FROM approved to something else)
  IF OLD IS NOT NULL AND OLD.status = 'approved' AND NEW.status != 'approved' THEN
    IF NEW.type = 'debit' THEN
      UPDATE merchant_customers
      SET current_balance = current_balance - NEW.amount,
          updated_at = now()
      WHERE merchant_id = NEW.merchant_id
        AND customer_id = NEW.customer_id;
    ELSIF NEW.type = 'credit' THEN
      UPDATE merchant_customers
      SET current_balance = current_balance + NEW.amount,
          updated_at = now()
      WHERE merchant_id = NEW.merchant_id
        AND customer_id = NEW.customer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix 2: Fire credit limit check on INSERT too (not just UPDATE of status)
-- Note: PostgreSQL INSERT triggers cannot reference OLD in WHEN clause,
-- so we fire on all INSERT + UPDATE OF status and let the function handle the check.
DROP TRIGGER IF EXISTS trg_check_credit_limit ON credit_logs;
CREATE TRIGGER trg_check_credit_limit
  BEFORE INSERT OR UPDATE OF status ON credit_logs
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION check_credit_limit();

-- Fix 3: Add UNIQUE constraint on customers(phone) to prevent duplicates
-- Creates an index (if not already present via the UNIQUE constraint) and
-- removes any existing duplicates before applying the constraint.
DELETE FROM customers a
USING customers b
WHERE a.id <> b.id
  AND a.phone = b.phone
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique ON customers(phone);

-- Fix 4: Add composite index for merchant credit_log queries
CREATE INDEX IF NOT EXISTS idx_credit_logs_merchant_status_created
  ON credit_logs(merchant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_logs_sync_status
  ON credit_logs(sync_status);
