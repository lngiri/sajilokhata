-- Add photo_url column to merchants table for profile photos
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT NULL;
