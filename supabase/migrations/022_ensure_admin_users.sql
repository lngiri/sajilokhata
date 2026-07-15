-- Migration 022: Ensure admin users exist
-- Run after production reset to guarantee at least one admin can log in.
-- Idempotent — safe to run multiple times.

-- Ensure the admins table exists (in case migrations 012/017 were skipped)
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Recreate the SELECT policy (idempotent via DROP + CREATE)
DROP POLICY IF EXISTS admins_select ON admins;
CREATE POLICY admins_select ON admins FOR SELECT USING (true);

-- Seed the primary admin account
INSERT INTO admins (email, name)
VALUES ('lngiri@gmail.com', 'Admin')
ON CONFLICT (email) DO NOTHING;

-- Future: add more admins here as needed
-- INSERT INTO admins (email, name) VALUES ('other@example.com', 'Other Admin')
-- ON CONFLICT (email) DO NOTHING;
