-- Admin users table — manually seeded with authorised admin emails
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- App-wide settings (branding, CMS, announcements)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow admin client (service_role) full access
-- RLS is bypassed via service_role key, so these are just for safety
CREATE POLICY "admins_select" ON admins FOR SELECT USING (true);
CREATE POLICY "app_settings_all" ON app_settings FOR ALL USING (true);

-- Seed a default admin (replace email as needed)
INSERT INTO admins (email, name)
VALUES ('lngiri@gmail.com', 'Admin')
ON CONFLICT (email) DO NOTHING;
