-- Migration 036: SMS billing system — manual payment requests
-- 1. sms_requests table for manual payment verification
-- 2. payment-proofs storage bucket for uploading screenshots

-- ─── sms_requests table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  sms_count INTEGER NOT NULL,
  transaction_id TEXT,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_requests_status ON sms_requests(status);
CREATE INDEX IF NOT EXISTS idx_sms_requests_merchant ON sms_requests(merchant_id);

-- Auto-update updated_at on status changes
CREATE OR REPLACE FUNCTION update_sms_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sms_requests_updated_at ON sms_requests;
CREATE TRIGGER trg_sms_requests_updated_at
  BEFORE UPDATE ON sms_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_requests_updated_at();

-- ─── payment-proofs storage bucket ──────────────────────────
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'payment-proofs',
  'payment-proofs',
  false,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/jpg'],
  5242880
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users (merchants) to upload screenshots
CREATE POLICY "Merchant Upload Payment Proof" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-proofs' AND auth.role() = 'authenticated'
  );

-- Allow authenticated users to read (admin uses service role)
CREATE POLICY "Authenticated Read Payment Proof" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'payment-proofs' AND auth.role() = 'authenticated'
  );
