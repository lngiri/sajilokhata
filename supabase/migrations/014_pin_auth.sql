-- Migration 014: PIN authentication support
-- Adds pin_hash column to merchants for quick 4-digit PIN login

ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS pin_hash TEXT DEFAULT NULL;
