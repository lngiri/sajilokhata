-- Migration 099: Wipe all test/legacy data for fresh start
-- Safe to run because there are no real users yet.
TRUNCATE TABLE
  credit_logs,
  customers,
  merchant_customers,
  merchant_payment_methods,
  merchant_reminder_settings,
  merchants,
  payment_reminder_logs,
  sessions,
  sms_recharge_logs,
  sms_requests,
  audit_logs
CASCADE;
