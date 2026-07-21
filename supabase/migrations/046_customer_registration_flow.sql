-- Migration 046: Customer Registration Flow
-- Adds registration_status to customers table
-- Creates customer_invites table for OTP token tracking

-- 1. Add registration_status to customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS registration_status TEXT NOT NULL DEFAULT 'invited'
    CHECK (registration_status IN ('invited', 'registered'));

-- Existing customers who have used the app are considered registered
UPDATE customers
  SET registration_status = 'registered'
  WHERE id IN (
    SELECT DISTINCT customer_id
    FROM credit_logs
    WHERE status IN ('approved', 'pending')
  );

-- Index for fast lookup by registration status
CREATE INDEX IF NOT EXISTS idx_customers_registration_status
  ON customers(registration_status);

-- 2. Customer invites table (OTP tokens for registration)
CREATE TABLE IF NOT EXISTS customer_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  used_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by phone + not-yet-used
CREATE INDEX IF NOT EXISTS idx_customer_invites_phone
  ON customer_invites(phone, used_at) WHERE used_at IS NULL;

-- RLS: Only service role can access invites (server-side only)
ALTER TABLE customer_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON customer_invites
  FOR ALL USING (false) WITH CHECK (false);
