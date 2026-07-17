-- Migration 037: Enforce UNIQUE phone constraints + customer avatar_url
-- 1. Safely clean any remaining duplicate phones in customers table
-- 2. Add proper UNIQUE constraint on customers.phone
-- 3. Add avatar_url column to customers

-- Remove duplicate customer phones keeping the oldest record
DELETE FROM customers a
USING customers b
WHERE a.id <> b.id
  AND a.phone = b.phone
  AND a.created_at > b.created_at;

-- Drop the existing unique index to replace with a proper constraint
DROP INDEX IF EXISTS idx_customers_phone_unique;

-- Add UNIQUE constraint at table level (proper constraint, not just index)
-- Drop first to make re-runs safe
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_key;
ALTER TABLE customers
ADD CONSTRAINT customers_phone_key UNIQUE (phone);

-- Keep the fast lookup index
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- Add avatar_url column for customer profile pictures
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;
