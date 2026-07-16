-- Migration 029: Merchant Payment Methods & Reminder System
-- Creates tables for merchant payment receiving methods, reminder settings, and reminder logs

-- ============================================================
-- 1. merchant_payment_methods
-- One row per method type per merchant (UNIQUE constraint)
-- ============================================================
CREATE TABLE IF NOT EXISTS merchant_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL CHECK (method_type IN ('fonepay', 'esewa', 'khalti', 'nepalpay', 'bank_deposit', 'cash')),
  label TEXT,
  qr_url TEXT,
  account_holder TEXT,
  account_number TEXT,
  bank_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, method_type)
);

CREATE INDEX IF NOT EXISTS idx_merchant_payment_methods_merchant
  ON merchant_payment_methods(merchant_id);

-- ============================================================
-- 2. merchant_reminder_settings
-- One row per merchant (UNIQUE merchant_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS merchant_reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  auto_reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  reminder_message_template TEXT DEFAULT 'Dear {customer}, pay Rs. {balance} to {shop}.',
  reminder_day_of_month INTEGER NOT NULL DEFAULT 1 CHECK (reminder_day_of_month BETWEEN 1 AND 28),
  last_reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(merchant_id)
);

-- ============================================================
-- 3. payment_reminder_logs
-- Audit trail for all sent reminders
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  credit_log_id UUID REFERENCES credit_logs(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('sms', 'share_link')),
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_reminder_logs_merchant
  ON payment_reminder_logs(merchant_id);

CREATE INDEX IF NOT EXISTS idx_reminder_logs_customer
  ON payment_reminder_logs(customer_id);
