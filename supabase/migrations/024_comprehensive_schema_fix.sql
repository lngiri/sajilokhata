-- Migration 024: Comprehensive schema fix
-- Adds ALL columns referenced by the application code that are missing
-- from the production database. Safe to run multiple times (uses IF NOT EXISTS).

-- ── 1. credit_logs.attachment_url (file upload support) ──
ALTER TABLE credit_logs
ADD COLUMN IF NOT EXISTS attachment_url TEXT DEFAULT NULL;

-- ── 2. merchants.status (admin suspend/activate support) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'merchants' AND column_name = 'status'
  ) THEN
    ALTER TABLE merchants ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'suspended'));
  END IF;
END $$;

-- ── 3. merchants.suspended_at (admin suspend tracking) ──
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ DEFAULT NULL;

-- ── 4. merchants.force_logout_at (admin force-logout kill-switch) ──
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS force_logout_at TIMESTAMPTZ DEFAULT NULL;

-- ── 5. customers.pin_hash (customer PIN login support) ──
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS pin_hash TEXT DEFAULT NULL;

-- ── 6. app_settings table (admin settings page) ──
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

