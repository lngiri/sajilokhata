-- ============================================================
-- Sajilo Khata - Complete PostgreSQL Schema for Supabase
-- ============================================================
-- Applies to: Production Supabase database (fresh, zero tables)
-- Phase: Testing / Pre-revenue (RLS is permissive for pilot shops)
-- ============================================================

-- Enable PostGIS extension for future delivery geofencing
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- 1. TABLE: merchants
-- Stores registered shop owner profiles.
-- Queried by: getMerchantProfile, updateMerchantProfile,
--             getMerchantByPhone, getMerchantStats
-- ============================================================
CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  business_type TEXT NOT NULL CHECK (business_type IN ('kirana', 'dairy', 'meat')),
  business_name TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. TABLE: customers
-- Stores customer identity (phone-based, no auth required).
-- Queried by: findOrCreateCustomer, getCustomerCreditLogs
-- ============================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  phone TEXT NOT NULL,
  home_location_gps GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup by phone (used by findOrCreateCustomer)
CREATE INDEX idx_customers_phone ON customers(phone);

-- ============================================================
-- 3. TABLE: merchant_customers (Junction / Ledger Account)
-- Links a customer to a merchant with credit limit & balance.
-- Queried by: linkCustomerToMerchant, getMerchantCustomers,
--             updateCustomerCreditLimit, getMerchantStats
-- ============================================================
CREATE TABLE merchant_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  credit_limit NUMERIC NOT NULL DEFAULT 5000 CHECK (credit_limit >= 0),
  current_balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, customer_id)
);

CREATE INDEX idx_merchant_customers_merchant ON merchant_customers(merchant_id);
CREATE INDEX idx_merchant_customers_customer ON merchant_customers(customer_id);

-- ============================================================
-- 4. TABLE: credit_logs (The Financial Ledger)
-- Every debit (credit taken) or credit (payment) entry.
-- Queried by: createCreditLog, getMerchantCreditLogs,
--             updateCreditLogStatus, getMerchantStats,
--             getCustomerCreditLogs
-- ============================================================
CREATE TABLE credit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  quantity NUMERIC,
  unit TEXT CHECK (unit IN ('liter', 'jar', 'kg', 'piece', 'npr')),
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'disputed', 'rejected')),
  sync_status TEXT NOT NULL DEFAULT 'online'
    CHECK (sync_status IN ('online', 'offline_pending')),
  ip_address TEXT,
  device_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast filtered queries
CREATE INDEX idx_credit_logs_merchant ON credit_logs(merchant_id);
CREATE INDEX idx_credit_logs_customer ON credit_logs(customer_id);
CREATE INDEX idx_credit_logs_status ON credit_logs(status);
CREATE INDEX idx_credit_logs_merchant_customer
  ON credit_logs(merchant_id, customer_id);
CREATE INDEX idx_credit_logs_created_at ON credit_logs(created_at DESC);

-- ============================================================
-- 5. TABLE: audit_logs (Immutable Audit Trail)
-- Records every status change on credit_logs for dispute resolution.
-- Queried by: updateCreditLogStatus (inserts audit entry)
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_log_id UUID NOT NULL REFERENCES credit_logs(id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN ('created', 'approved', 'disputed', 'rejected', 'modified')),
  actor_id UUID,
  actor_type TEXT CHECK (actor_type IN ('merchant', 'customer', 'admin')),
  ip_address TEXT,
  device_info TEXT,
  previous_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_credit_log ON audit_logs(credit_log_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================
-- 6. TABLE: sessions (Multi-device merchant sessions)
-- Allows concurrent active sessions for shop family members.
-- Not actively queried yet — reserved for future use.
-- ============================================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  device_info TEXT NOT NULL,
  last_active TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_merchant ON sessions(merchant_id);

-- ============================================================
-- TRIGGER: Auto-update current_balance
-- When a credit_log status changes to 'approved', automatically
-- update the merchant_customers current_balance.
--   - debit  → current_balance += amount (customer owes more)
--   - credit → current_balance -= amount (customer paid)
-- ============================================================
CREATE OR REPLACE FUNCTION update_merchant_customer_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' THEN
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_balance
  AFTER INSERT OR UPDATE OF status ON credit_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_merchant_customer_balance();

-- ============================================================
-- TRIGGER: Enforce credit limit
-- Before approving a debit entry, check that the customer
-- hasn't exceeded their credit limit. Raises an exception
-- if the new entry would push the balance over the limit.
-- ============================================================
CREATE OR REPLACE FUNCTION check_credit_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_limit NUMERIC;
  v_balance NUMERIC;
  v_max_credit NUMERIC;
BEGIN
  IF NEW.type = 'debit' AND NEW.status = 'approved' THEN
    SELECT credit_limit, current_balance INTO v_limit, v_balance
    FROM merchant_customers
    WHERE merchant_id = NEW.merchant_id
      AND customer_id = NEW.customer_id;

    v_max_credit := v_limit - v_balance;

    IF NEW.amount > v_max_credit THEN
      RAISE EXCEPTION
        'Credit limit exceeded. Available credit: %, attempted: %',
        v_max_credit, NEW.amount;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_credit_limit
  BEFORE UPDATE OF status ON credit_logs
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
  EXECUTE FUNCTION check_credit_limit();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — PERMISSIVE MODE
-- ============================================================
-- During the pre-revenue / testing phase, all tables use
-- permissive RLS policies that allow any operation by any
-- role (authenticated or anonymous). This lets pilot shops
-- and customers (who authenticate via localStorage, not
-- Supabase Auth) use the app without RLS blocks.
--
-- When moving to production, replace the `true` policies
-- with proper auth.uid() checks, then run:
--   ALTER TABLE ... FORCE ROW LEVEL SECURITY;
-- ============================================================

ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Allow all operations on all tables during testing
CREATE POLICY "Permissive: all operations allowed (testing phase)"
  ON merchants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permissive: all operations allowed (testing phase)"
  ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permissive: all operations allowed (testing phase)"
  ON merchant_customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permissive: all operations allowed (testing phase)"
  ON credit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permissive: all operations allowed (testing phase)"
  ON audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permissive: all operations allowed (testing phase)"
  ON sessions FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- MATERIALIZED VIEW: Customer Summary (for merchant dashboard)
-- Pre-computes per-customer stats so the dashboard can display
-- them with a single SELECT instead of running aggregations
-- across credit_logs on every page load.
-- ============================================================
CREATE MATERIALIZED VIEW customer_summary AS
SELECT
  mc.merchant_id,
  mc.customer_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  mc.credit_limit,
  mc.current_balance,
  COUNT(CASE WHEN cl.status = 'pending' THEN 1 END) AS pending_entries,
  COUNT(CASE WHEN cl.status = 'approved' AND cl.type = 'debit' THEN 1 END)
    AS total_debit_entries,
  COUNT(CASE WHEN cl.status = 'approved' AND cl.type = 'credit' THEN 1 END)
    AS total_credit_entries,
  COALESCE(
    SUM(CASE WHEN cl.status = 'approved' AND cl.type = 'debit'
      THEN cl.amount ELSE 0 END), 0
  ) AS total_debit_amount,
  COALESCE(
    SUM(CASE WHEN cl.status = 'approved' AND cl.type = 'credit'
      THEN cl.amount ELSE 0 END), 0
  ) AS total_credit_amount,
  MAX(cl.created_at) AS last_transaction_at
FROM merchant_customers mc
JOIN customers c ON c.id = mc.customer_id
LEFT JOIN credit_logs cl
  ON cl.merchant_id = mc.merchant_id
  AND cl.customer_id = mc.customer_id
GROUP BY
  mc.merchant_id, mc.customer_id,
  c.name, c.phone,
  mc.credit_limit, mc.current_balance;

CREATE UNIQUE INDEX idx_customer_summary
  ON customer_summary(merchant_id, customer_id);
