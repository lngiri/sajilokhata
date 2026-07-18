-- Migration 041: Add password authentication for admin panel
-- Critical security fix: admins must now authenticate with a bcrypt password

ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Set a random initial password hash for existing admin(s)
-- This forces the admin to use the password reset flow
-- Default: "admin123" (bcrypt 10 rounds) — MUST be changed on first login
UPDATE public.admins
SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
WHERE password_hash IS NULL;
