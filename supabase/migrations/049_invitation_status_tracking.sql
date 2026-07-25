-- Migration 049: Invitation Status Tracking
-- Adds status tracking and resend fields to customer_invites
-- Uses customer_invites.id (PK) as external-facing invite identifier
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
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. Index for merchant listing
CREATE INDEX IF NOT EXISTS idx_customer_invites_merchant_status
  ON customer_invites(merchant_id, status, created_at DESC);

-- 3. Index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_customer_invites_active_phone_merchant
  ON customer_invites(phone, merchant_id)
  WHERE used_at IS NULL AND status NOT IN ('cancelled', 'expired');

-- 4. RLS: only service role may access this table
DROP POLICY IF EXISTS "Service role only" ON customer_invites;
ALTER TABLE customer_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON customer_invites
  FOR ALL USING (false) WITH CHECK (false);
