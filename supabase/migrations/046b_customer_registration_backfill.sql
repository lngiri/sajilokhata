-- Migration 046b: Customer Registration — Historical Backfill
-- This file is NOT automatically applied.
-- Run manually only if you want to mark existing customers
-- who have transactions as 'registered' instead of 'invited'.
--
-- Safe to skip: no application logic depends on this value.
-- Only affects customers who have approved or pending credit logs.

UPDATE customers
  SET registration_status = 'registered'
  WHERE id IN (
    SELECT DISTINCT customer_id
    FROM credit_logs
    WHERE status IN ('approved', 'pending')
  );
