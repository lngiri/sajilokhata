-- Migration 039: Harden RLS — remove ALL permissive testing policies
-- Replaces every "Permissive: all operations allowed (testing phase)" policy
-- with scoped, auth.uid()-based policies across all tables.
-- Also hardens credit_logs: no more blanket anon read.

-- ============================================================
-- 1. merchants
-- ============================================================
DROP POLICY IF EXISTS "Permissive: all operations allowed (testing phase)" ON merchants;

CREATE POLICY "Merchants read own profile"
  ON merchants FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Merchants update own profile"
  ON merchants FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Merchants insert own profile"
  ON merchants FOR INSERT
  WITH CHECK (id = auth.uid());

-- ============================================================
-- 2. customers
-- Permissive read kept for phone-based lookup (no Supabase Auth for customers).
-- Write requires authentication.
-- ============================================================
DROP POLICY IF EXISTS "Permissive: all operations allowed (testing phase)" ON customers;

CREATE POLICY "Anyone can read customers"
  ON customers FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create customers"
  ON customers FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- 3. merchant_customers
-- ============================================================
DROP POLICY IF EXISTS "Permissive: all operations allowed (testing phase)" ON merchant_customers;

CREATE POLICY "Merchants read their own customer links"
  ON merchant_customers FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants insert their own customer links"
  ON merchant_customers FOR INSERT
  WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Merchants update their own customer links"
  ON merchant_customers FOR UPDATE
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

-- ============================================================
-- 4. credit_logs (THE CRITICAL FIX)
-- ============================================================
DROP POLICY IF EXISTS "Permissive: all operations allowed (testing phase)" ON credit_logs;
DROP POLICY IF EXISTS "Anyone can read credit_logs" ON credit_logs;
DROP POLICY IF EXISTS "Authenticated merchants can insert credit_logs" ON credit_logs;

DROP POLICY IF EXISTS "Merchants read their own credit_logs" ON credit_logs;
DROP POLICY IF EXISTS "Merchants insert credit_logs" ON credit_logs;
DROP POLICY IF EXISTS "Merchants update their own credit_logs" ON credit_logs;

CREATE POLICY "Merchants read their own credit_logs"
  ON credit_logs FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants insert credit_logs"
  ON credit_logs FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND merchant_id = auth.uid()
  );

CREATE POLICY "Merchants update their own credit_logs"
  ON credit_logs FOR UPDATE
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

-- ============================================================
-- 5. audit_logs
-- ============================================================
DROP POLICY IF EXISTS "Permissive: all operations allowed (testing phase)" ON audit_logs;

CREATE POLICY "Merchants read audit logs for their credit_logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM credit_logs cl
      WHERE cl.id = audit_logs.credit_log_id
        AND cl.merchant_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert audit_logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 6. sessions
-- ============================================================
DROP POLICY IF EXISTS "Permissive: all operations allowed (testing phase)" ON sessions;

CREATE POLICY "Merchants read their own sessions"
  ON sessions FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants insert their own sessions"
  ON sessions FOR INSERT
  WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Merchants delete their own sessions"
  ON sessions FOR DELETE
  USING (merchant_id = auth.uid());
