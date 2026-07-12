-- ============================================================
-- 010: Remove cross-table role validation trigger
-- ============================================================
-- A phone number should be allowed to exist in BOTH merchants
-- AND customers simultaneously. A shop owner can also be a
-- customer at another merchant's shop.
-- ============================================================

DROP TRIGGER IF EXISTS before_merchant_insert_update ON merchants;
DROP TRIGGER IF EXISTS before_customer_insert_update ON customers;
DROP FUNCTION IF EXISTS check_cross_table_role_conflict;
