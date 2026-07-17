-- Migration 034: Add payment_enabled column to merchants
-- Controls the master "Receive Payment Option" toggle on the merchant settings page.
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS payment_enabled BOOLEAN NOT NULL DEFAULT true;

-- Existing rows get the default (true), so no merchant is locked out unexpectedly.
