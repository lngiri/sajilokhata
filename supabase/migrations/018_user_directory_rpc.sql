-- ============================================================
-- Migration 018: Safe directory queries (no column assumptions)
-- Uses COALESCE to handle potential missing columns
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_directory_safe()
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  role TEXT,
  business_name TEXT,
  created_at TIMESTAMPTZ
) LANGUAGE SQL AS $$
  SELECT
    m.id,
    m.name,
    m.phone,
    CASE WHEN c.id IS NOT NULL THEN 'both' ELSE 'merchant' END::TEXT,
    COALESCE(m.business_name, '')::TEXT,
    m.created_at
  FROM merchants m
  LEFT JOIN customers c ON m.phone = c.phone

  UNION ALL

  SELECT
    c.id,
    c.name,
    c.phone,
    CASE WHEN m.id IS NOT NULL THEN 'both' ELSE 'customer' END::TEXT,
    ''::TEXT,
    c.created_at
  FROM customers c
  LEFT JOIN merchants m ON c.phone = m.phone
  WHERE NOT EXISTS (SELECT 1 FROM merchants m2 WHERE m2.phone = c.phone)
  ORDER BY created_at DESC;
$$;
