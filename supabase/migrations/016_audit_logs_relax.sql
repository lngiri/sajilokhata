-- ============================================================
-- Migration 016: Relax audit_logs constraints for non-transaction events
-- Allows logging actions (e.g. pin_reset) that are not tied to a
-- specific credit_log row.
-- ============================================================

-- Make credit_log_id nullable so we can log customer-level events
ALTER TABLE audit_logs ALTER COLUMN credit_log_id DROP NOT NULL;

-- Relax action CHECK to include all values used by the codebase
-- plus the new pin_reset action
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'created',
    'approved',
    'disputed',
    'rejected',
    'modified',
    'edit_requested',
    'edit_accepted',
    'edit_rejected',
    'pin_reset'
  ));
