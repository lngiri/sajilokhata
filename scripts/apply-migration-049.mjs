import { createClient } from '@supabase/supabase-js';

const url = 'https://smbzejjkymovdetqjski.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtYnplampreW1vdmRldHFqc2tpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzc1ODcyMCwiZXhwIjoyMDk5MzM0NzIwfQ.0ziEtmkHmHroXR5C0eq30P7-lggROcslQjd7aNMceEc';

const sql = `
ALTER TABLE customer_invites
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sms_sent','sms_failed','invitation_opened','otp_verified','registration_completed','expired','cancelled')),
  ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_error TEXT,
  ADD COLUMN IF NOT EXISTS last_resent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resend_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_customer_invites_merchant_status
  ON customer_invites(merchant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_invites_active_phone_merchant
  ON customer_invites(phone, merchant_id)
  WHERE used_at IS NULL AND status NOT IN ('cancelled', 'expired');

DROP POLICY IF EXISTS "Service role only" ON customer_invites;
ALTER TABLE customer_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON customer_invites
  FOR ALL USING (false) WITH CHECK (false);
`;

async function main() {
  // Execute SQL via Supabase REST API
  const res = await fetch(url + '/rest/v1/rpc/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Accept': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  if (!res.ok) {
    const text = await res.text();
    console.log('SQL endpoint error:', res.status, text.substring(0, 500));
    return;
  }
  console.log('Migration 049 applied successfully');

  // Verify columns exist
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const m049Cols = ['status', 'sms_sent_at', 'sms_error', 'last_resent_at', 'resend_count', 'opened_at', 'completed_at'];
  let allExist = true;
  for (const col of m049Cols) {
    const { data, error } = await admin.from('customer_invites').select(col).limit(1);
    if (error && (error.message?.includes('column') || error.code === 'PGRST204')) {
      console.log('  MISSING:', col);
      allExist = false;
    } else {
      console.log('  EXISTS:', col);
    }
  }
  console.log(allExist ? 'All 7 columns present!' : 'Some columns still missing!');
}

main().catch(e => console.error('Fatal:', e));
