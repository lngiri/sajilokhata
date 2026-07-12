-- ============================================================
-- 009: Normalize phone numbers & merge duplicate merchants
-- ============================================================
-- 1. Normalize all merchant phones to +977XXXXXXXXX format
-- 2. Merge duplicate merchants (same normalized phone, different IDs)
-- 3. Re-apply UNIQUE constraint on merchants.phone
-- 4. Normalize customer phones (no uniqueness requirement, but nice)
-- ============================================================

-- Step 1: Helper function to normalize phone numbers
CREATE OR REPLACE FUNCTION normalize_phone_number(phone TEXT)
RETURNS TEXT AS $$
DECLARE
  digits TEXT;
BEGIN
  digits := regexp_replace(phone, '\D', '', 'g');
  IF digits LIKE '977%' THEN
    RETURN '+' || digits;
  ELSE
    RETURN '+977' || digits;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Temporarily drop the UNIQUE constraint so we can normalize phones
ALTER TABLE merchants DROP CONSTRAINT IF EXISTS merchants_phone_key;

-- Step 3: Normalize all existing merchant phones
UPDATE merchants
SET phone = normalize_phone_number(phone)
WHERE phone != normalize_phone_number(phone);

-- Step 4: Identify and merge duplicate merchants
DO $$
DECLARE
  dup RECORD;
  survivor_id UUID;
  duplicate_id UUID;
  dup_count INT := 0;
BEGIN
  -- Find all phone numbers that have multiple merchants
  FOR dup IN
    SELECT phone, array_agg(id ORDER BY created_at ASC, id ASC) AS ids,
           array_agg(created_at ORDER BY created_at ASC, id ASC) AS created_ats
    FROM merchants
    GROUP BY phone
    HAVING COUNT(*) > 1
  LOOP
    -- The first ID in the sorted array is the survivor (oldest created_at)
    survivor_id := dup.ids[1];

    -- Process each duplicate (skip the survivor)
    FOR i IN 2 .. array_length(dup.ids, 1) LOOP
      duplicate_id := dup.ids[i];

      -- 3a. Reassign credit_logs from duplicate to survivor
      UPDATE credit_logs
      SET merchant_id = survivor_id
      WHERE merchant_id = duplicate_id;

      -- 3b. Reassign merchant_customers, merging where the same customer exists
      -- For customers that exist ONLY in the duplicate: update to survivor
      UPDATE merchant_customers mc_dup
      SET merchant_id = survivor_id
      FROM (
        SELECT id FROM merchant_customers
        WHERE merchant_id = duplicate_id
          AND customer_id NOT IN (
            SELECT customer_id FROM merchant_customers
            WHERE merchant_id = survivor_id
          )
      ) AS keepers
      WHERE mc_dup.id = keepers.id;

      -- For customers that exist in BOTH: merge fields, then delete duplicate's row
      UPDATE merchant_customers mc_survivor
      SET
        credit_limit = GREATEST(mc_survivor.credit_limit, mc_dup.credit_limit),
        current_balance = mc_survivor.current_balance + mc_dup.current_balance,
        updated_at = now()
      FROM merchant_customers mc_dup
      WHERE mc_survivor.merchant_id = survivor_id
        AND mc_dup.merchant_id = duplicate_id
        AND mc_survivor.customer_id = mc_dup.customer_id;

      DELETE FROM merchant_customers
      WHERE merchant_id = duplicate_id;

      -- 3c. Reassign sessions
      UPDATE sessions
      SET merchant_id = survivor_id
      WHERE merchant_id = duplicate_id;

      -- 3d. Delete the duplicate merchant
      DELETE FROM merchants WHERE id = duplicate_id;

      dup_count := dup_count + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Merged % duplicate merchant(s)', dup_count;
END $$;

-- Step 5: Re-apply UNIQUE constraint on normalized data
ALTER TABLE merchants ADD CONSTRAINT merchants_phone_key UNIQUE (phone);

-- Step 6: Normalize customer phones for consistency
UPDATE customers
SET phone = normalize_phone_number(phone)
WHERE phone != normalize_phone_number(phone);

-- Step 7: Cleanup helper function
DROP FUNCTION normalize_phone_number;
