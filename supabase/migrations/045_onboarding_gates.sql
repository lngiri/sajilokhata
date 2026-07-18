-- Migration 045: Onboarding gates — profile completeness enforcement
-- ================================================================================

-- 1. Add address column to customers (for credit recovery contact info)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';

-- 2. Expand merchants.business_type CHECK to match TypeScript enum (8 values)
ALTER TABLE merchants DROP CONSTRAINT IF EXISTS merchants_business_type_check;
ALTER TABLE merchants ADD CONSTRAINT merchants_business_type_check
  CHECK (business_type IN ('kirana','dairy','meat','hardware','clothing','pharmacy','restaurant','other'));

-- 3. Backfill merchants.address default so existing rows are non-null
ALTER TABLE merchants ALTER COLUMN address SET DEFAULT '';
UPDATE merchants SET address = '' WHERE address IS NULL;
