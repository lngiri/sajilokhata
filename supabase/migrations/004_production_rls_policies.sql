-- ============================================================
-- Sajilo Khata - Migration 004: Production RLS Policies
-- ============================================================
-- Replaces permissive testing policies with proper auth.uid()
-- checks for merchant-owned tables.
--
-- Merchant auth: merchant.id == auth.uid() (set by bypass endpoint)
-- Customer auth: customers use anon key (no Supabase Auth session)
--   so credit_logs and customers tables retain permissive read
--   access. Write access is restricted.
-- ============================================================

-- Drop permissive testing policies
DROP POLICY IF EXISTS "Permissive: all operations allowed (testing phase)" ON merchants;
DROP POLICY IF EXISTS "Permissive: all operations allowed (testing phase)" ON customers;
DROP POLICY IF EXISTS "Permissive: all operations allowed (testing phase)" ON merchant_customers;
DROP POLICY IF EXISTS "Permissive: all operations allowed (testing phase)" ON credit_logs;
DROP POLICY IF EXISTS "Permissive: all operations allowed (testing phase)" ON audit_logs;
DROP POLICY IF EXISTS "Permissive: all operations allowed (testing phase)" ON sessions;

-- ============================================================
-- merchants: each merchant can only manage their own profile
-- ============================================================
CREATE POLICY "Merchants can read own profile"
  ON merchants FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Merchants can update own profile"
  ON merchants FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Merchants can insert own profile"
  ON merchants FOR INSERT
  WITH CHECK (id = auth.uid());

-- ============================================================
-- customers: permissive read (phone-based lookup), write requires auth
-- ============================================================
CREATE POLICY "Anyone can read customers"
  ON customers FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create customers"
  ON customers FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- merchant_customers: merchants manage their own links
-- ============================================================
CREATE POLICY "Merchants can read their own customer links"
  ON merchant_customers FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can insert their own customer links"
  ON merchant_customers FOR INSERT
  WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Merchants can update their own customer links"
  ON merchant_customers FOR UPDATE
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

-- ============================================================
-- credit_logs: merchants see their own logs, customers see their
-- own via anon key (no auth.uid()). We keep SELECT permissive
-- for now since customers don't use Supabase Auth.
-- ============================================================
CREATE POLICY "Anyone can read credit_logs"
  ON credit_logs FOR SELECT
  USING (true);

CREATE POLICY "Authenticated merchants can insert credit_logs"
  ON credit_logs FOR INSERT
  WITH CHECK (
    -- Either the merchant is authenticated
    (auth.role() = 'authenticated' AND merchant_id = auth.uid())
    -- Or it's a customer submission (no auth, anon role)
    OR (auth.role() = 'anon')
  );

CREATE POLICY "Merchants can update their own credit_logs"
  ON credit_logs FOR UPDATE
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

-- ============================================================
-- audit_logs: merchants can read audit entries for their logs
-- ============================================================
CREATE POLICY "Merchants can read audit logs for their credit_logs"
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
-- sessions: merchants manage their own sessions
-- ============================================================
CREATE POLICY "Merchants can read their own sessions"
  ON sessions FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can insert their own sessions"
  ON sessions FOR INSERT
  WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Merchants can delete their own sessions"
  ON sessions FOR DELETE
  USING (merchant_id = auth.uid());
