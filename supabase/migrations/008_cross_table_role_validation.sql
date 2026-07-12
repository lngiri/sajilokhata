-- ============================================================
-- Sajilo Khata - Migration 008: Cross-Table Role Validation
-- ============================================================
-- Prevents the same phone number from being registered as both
-- a merchant and a customer, avoiding session hijacking and
-- role-conflict authorization crashes.
--
-- Enforced at the database level via triggers on both tables.
-- ============================================================

-- First, clean up any existing data conflicts before adding constraints
UPDATE customers SET phone = phone || '-migrated-customer'
WHERE phone IN (SELECT phone FROM merchants);

-- ============================================================
-- Trigger function: check_cross_table_role_conflict
-- ============================================================
-- Raises an exception if a phone already exists in the opposite
-- role table (merchant ↔ customer).
-- ============================================================
CREATE OR REPLACE FUNCTION check_cross_table_role_conflict()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'merchants' THEN
    IF EXISTS (SELECT 1 FROM customers WHERE phone = NEW.phone) THEN
      RAISE EXCEPTION 'यो नम्बर ग्राहक (Customer) को रूपमा दर्ता भइसकेको छ। (%)', NEW.phone
        USING ERRCODE = '23505'; -- unique_violation
    END IF;
  ELSIF TG_TABLE_NAME = 'customers' THEN
    IF EXISTS (SELECT 1 FROM merchants WHERE phone = NEW.phone) THEN
      RAISE EXCEPTION 'यो नम्बर व्यापारी (Merchant) को रूपमा दर्ता भइसकेको छ। (%)', NEW.phone
        USING ERRCODE = '23505'; -- unique_violation
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Trigger: before_merchant_insert_update
-- ============================================================
DROP TRIGGER IF EXISTS before_merchant_insert_update ON merchants;
CREATE TRIGGER before_merchant_insert_update
  BEFORE INSERT OR UPDATE OF phone ON merchants
  FOR EACH ROW
  EXECUTE FUNCTION check_cross_table_role_conflict();

-- ============================================================
-- Trigger: before_customer_insert_update
-- ============================================================
DROP TRIGGER IF EXISTS before_customer_insert_update ON customers;
CREATE TRIGGER before_customer_insert_update
  BEFORE INSERT OR UPDATE OF phone ON customers
  FOR EACH ROW
  EXECUTE FUNCTION check_cross_table_role_conflict();
