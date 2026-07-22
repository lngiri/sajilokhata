-- Migration 046a: Customer Registration Flow — Schema Only
-- NO data modification (no UPDATE/INSERT/DELETE)

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS registration_status TEXT NOT NULL DEFAULT 'invited'
    CHECK (registration_status IN ('invited', 'registered'));

CREATE INDEX IF NOT EXISTS idx_customers_registration_status
  ON customers(registration_status);

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

CREATE INDEX IF NOT EXISTS idx_customer_invites_phone
  ON customer_invites(phone, used_at) WHERE used_at IS NULL;

ALTER TABLE customer_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON customer_invites
  FOR ALL USING (false) WITH CHECK (false);
