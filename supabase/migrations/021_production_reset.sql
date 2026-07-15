-- Migration 021: Production Reset — wipe all user data
-- One-time operation. Keeps admins table intact.

-- Truncate all app data tables (order doesn't matter with CASCADE)
TRUNCATE TABLE
  sessions,
  credit_logs,
  merchant_customers,
  customers,
  merchants,
  audit_logs
CASCADE;

-- All tables use UUID primary keys (gen_random_uuid()), so no sequences to reset.
-- Next inserts will generate fresh UUIDs automatically.
