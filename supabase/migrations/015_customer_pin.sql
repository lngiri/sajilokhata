-- Migration 015: Customer PIN authentication support
-- Adds pin_hash column to customers for 4-digit PIN login

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS pin_hash TEXT DEFAULT NULL;
