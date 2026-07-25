-- Migration 049: Invitation Status Tracking
-- Adds status tracking, invite_token, and resend fields to customer_invites
-- Adds merchant-readable RLS policy
-- Adds notification type for customer_registered_from_invitation

-- 1. Add new columns to customer_invites
ALTER TABLE customer_invites
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'sms_sent',
      'sms_failed',
      'invitation_opened',
      'otp_verified',
      'registration_completed',
      'expired',
      'cancelled'
    )),
  ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_error TEXT,
  ADD COLUMN IF NOT EXISTS last_resent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resend_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invite_token UUID NOT NULL DEFAULT gen_random_uuid();

-- 2. Index for merchant listing
CREATE INDEX IF NOT EXISTS idx_customer_invites_merchant_status
  ON customer_invites(merchant_id, status, created_at DESC);

-- 3. Index for invite_token lookup
CREATE INDEX IF NOT EXISTS idx_customer_invites_invite_token
  ON customer_invites(invite_token)
  WHERE used_at IS NULL;

-- 4. Index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_customer_invites_active_phone_merchant
  ON customer_invites(phone, merchant_id)
  WHERE used_at IS NULL AND status NOT IN ('cancelled', 'expired');

-- 5. Update RLS: allow merchant to SELECT their own invites
DROP POLICY IF EXISTS "Service role only" ON customer_invites;
ALTER TABLE customer_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON customer_invites
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Merchant can read own invites" ON customer_invites
  FOR SELECT
  USING (
    merchant_id = current_setting('request.jwt.claims.merchant_id', true)::uuid
    OR
    merchant_id IN (
      SELECT id FROM merchants
      WHERE phone = current_setting('request.jwt.claims.phone', true)::text
    )
  );
