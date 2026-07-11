-- ============================================================
-- Sajilo Khata - Complete PostgreSQL Schema for Supabase
-- ============================================================

-- Enable PostGIS extension for geofencing (if not already enabled)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- 1. TABLE: merchants
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
-- ============================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  phone TEXT NOT NULL,
  home_location_gps GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for customers by phone
CREATE INDEX idx_customers_phone ON customers(phone);

-- ============================================================
-- 3. TABLE: merchant_customers (Junction Table)
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

-- Indexes for merchant_customers
CREATE INDEX idx_merchant_customers_merchant ON merchant_customers(merchant_id);
CREATE INDEX idx_merchant_customers_customer ON merchant_customers(customer_id);

-- ============================================================
-- 4. TABLE: credit_logs (The Financial Ledger)
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
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'disputed', 'rejected')),
  sync_status TEXT NOT NULL DEFAULT 'online' CHECK (sync_status IN ('online', 'offline_pending')),
  ip_address TEXT,
  device_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for credit_logs
CREATE INDEX idx_credit_logs_merchant ON credit_logs(merchant_id);
CREATE INDEX idx_credit_logs_customer ON credit_logs(customer_id);
CREATE INDEX idx_credit_logs_status ON credit_logs(status);
CREATE INDEX idx_credit_logs_merchant_customer ON credit_logs(merchant_id, customer_id);
CREATE INDEX idx_credit_logs_created_at ON credit_logs(created_at DESC);

-- ============================================================
-- 5. TABLE: audit_logs (Immutable audit trail)
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_log_id UUID NOT NULL REFERENCES credit_logs(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'approved', 'disputed', 'rejected', 'modified')),
  actor_id UUID,
  actor_type TEXT CHECK (actor_type IN ('merchant', 'customer', 'admin')),
  ip_address TEXT,
  device_info TEXT,
  previous_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for audit_logs
CREATE INDEX idx_audit_logs_credit_log ON audit_logs(credit_log_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================
-- 6. TABLE: sessions (Multi-device merchant sessions)
-- ============================================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  device_info TEXT NOT NULL,
  last_active TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for sessions
CREATE INDEX idx_sessions_merchant ON sessions(merchant_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to update current_balance on merchant_customers
CREATE OR REPLACE FUNCTION update_merchant_customer_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    IF NEW.type = 'debit' THEN
      UPDATE merchant_customers
      SET current_balance = current_balance + NEW.amount,
          updated_at = now()
      WHERE merchant_id = NEW.merchant_id AND customer_id = NEW.customer_id;
    ELSIF NEW.type = 'credit' THEN
      UPDATE merchant_customers
      SET current_balance = current_balance - NEW.amount,
          updated_at = now()
      WHERE merchant_id = NEW.merchant_id AND customer_id = NEW.customer_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update balance
CREATE TRIGGER trg_update_balance
  AFTER INSERT OR UPDATE OF status ON credit_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_merchant_customer_balance();

-- Function to check credit limit
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
    WHERE merchant_id = NEW.merchant_id AND customer_id = NEW.customer_id;

    v_max_credit := v_limit - v_balance;

    IF NEW.amount > v_max_credit THEN
      RAISE EXCEPTION 'Credit limit exceeded. Available credit: %, attempted: %', v_max_credit, NEW.amount;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check credit limit before approval
CREATE TRIGGER trg_check_credit_limit
  BEFORE UPDATE OF status ON credit_logs
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
  EXECUTE FUNCTION check_credit_limit();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- MERCHANTS: Only authenticated users can view/update their own merchant profile
CREATE POLICY "Merchants can view own profile"
  ON merchants FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Merchants can update own profile"
  ON merchants FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Anyone can create merchant account"
  ON merchants FOR INSERT
  WITH CHECK (true);

-- CUSTOMERS: Merchants can view customers linked to them
CREATE POLICY "Merchants can view linked customers"
  ON customers FOR SELECT
  USING (
    id IN (
      SELECT customer_id FROM merchant_customers
      WHERE merchant_id = auth.uid()
    )
  );

-- MERCHANT_CUSTOMERS: Merchants can view/modify their own junction records
CREATE POLICY "Merchants can view own junction records"
  ON merchant_customers FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can update own junction records"
  ON merchant_customers FOR UPDATE
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can insert own junction records"
  ON merchant_customers FOR INSERT
  WITH CHECK (merchant_id = auth.uid());

-- CREDIT_LOGS: Merchants can view/modify logs where they are the merchant
CREATE POLICY "Merchants can view own credit logs"
  ON credit_logs FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can insert own credit logs"
  ON credit_logs FOR INSERT
  WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Merchants can update own credit logs"
  ON credit_logs FOR UPDATE
  USING (merchant_id = auth.uid());

-- AUDIT_LOGS: Only viewable by the merchant who owns the associated credit log
CREATE POLICY "Merchants can view own audit logs"
  ON audit_logs FOR SELECT
  USING (
    credit_log_id IN (
      SELECT id FROM credit_logs WHERE merchant_id = auth.uid()
    )
  );

-- SESSIONS: Merchants can view/modify their own sessions
CREATE POLICY "Merchants can view own sessions"
  ON sessions FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can insert own sessions"
  ON sessions FOR INSERT
  WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Merchants can update own sessions"
  ON sessions FOR UPDATE
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can delete own sessions"
  ON sessions FOR DELETE
  USING (merchant_id = auth.uid());

-- ============================================================
-- MATERIALIZED VIEW: Customer Summary (for dashboard)
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
  COUNT(CASE WHEN cl.status = 'approved' AND cl.type = 'debit' THEN 1 END) AS total_debit_entries,
  COUNT(CASE WHEN cl.status = 'approved' AND cl.type = 'credit' THEN 1 END) AS total_credit_entries,
  COALESCE(SUM(CASE WHEN cl.status = 'approved' AND cl.type = 'debit' THEN cl.amount ELSE 0 END), 0) AS total_debit_amount,
  COALESCE(SUM(CASE WHEN cl.status = 'approved' AND cl.type = 'credit' THEN cl.amount ELSE 0 END), 0) AS total_credit_amount,
  MAX(cl.created_at) AS last_transaction_at
FROM merchant_customers mc
JOIN customers c ON c.id = mc.customer_id
LEFT JOIN credit_logs cl ON cl.merchant_id = mc.merchant_id AND cl.customer_id = mc.customer_id
GROUP BY mc.merchant_id, mc.customer_id, c.name, c.phone, mc.credit_limit, mc.current_balance;

CREATE UNIQUE INDEX idx_customer_summary ON customer_summary(merchant_id, customer_id);
