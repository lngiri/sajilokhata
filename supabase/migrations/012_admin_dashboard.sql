-- ── Admin users table — manually seeded with authorised admin emails ──
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- ── App-wide settings (branding, CMS, announcements) ──
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- ── Add suspend/block support to merchants ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'merchants' AND column_name = 'status'
  ) THEN
    ALTER TABLE merchants ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'suspended'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'merchants' AND column_name = 'suspended_at'
  ) THEN
    ALTER TABLE merchants ADD COLUMN suspended_at TIMESTAMPTZ;
  END IF;
END $$;

-- ── RLS policies (bypassed by service_role, for safety) ──
DROP POLICY IF EXISTS "admins_select" ON admins;
CREATE POLICY "admins_select" ON admins FOR SELECT USING (true);
DROP POLICY IF EXISTS "app_settings_all" ON app_settings;
CREATE POLICY "app_settings_all" ON app_settings FOR ALL USING (true);

-- ── Seed default admin ──
INSERT INTO admins (email, name)
VALUES ('lngiri@gmail.com', 'Admin')
ON CONFLICT (email) DO NOTHING;
