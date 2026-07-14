-- ============================================================
-- Migration 017: Ensure admins table and seed admin exist
-- Remediation for migration 012 not being executed
-- ============================================================

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admins_select ON admins;
CREATE POLICY admins_select ON admins FOR SELECT USING (true);

INSERT INTO admins (email, name) VALUES ('lngiri@gmail.com', 'Admin')
ON CONFLICT (email) DO NOTHING;
