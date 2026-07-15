-- ============================================================
-- Fix business_type CHECK constraint to match UI options
-- ============================================================

ALTER TABLE merchants DROP CONSTRAINT IF EXISTS merchants_business_type_check;

ALTER TABLE merchants ADD CONSTRAINT merchants_business_type_check
  CHECK (business_type IN ('kirana', 'dairy', 'meat', 'hardware', 'clothing', 'pharmacy', 'restaurant', 'other'));

-- Also ensure photo_url column exists (migration 025 may not have been applied)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'merchants' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE merchants ADD COLUMN photo_url TEXT DEFAULT NULL;
  END IF;
END $$;
