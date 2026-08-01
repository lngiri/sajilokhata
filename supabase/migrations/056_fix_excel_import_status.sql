-- Migration 056: Fix Excel import tools after status merge (053)
-- ================================================================================
-- Migration 053 merged 'pending'/'unverified' into 'awaiting_confirmation' and
-- dropped 'pending' from the credit_logs CHECK constraint. The import_customers
-- RPC still inserted status='pending', which now violates the CHECK constraint
-- and breaks Excel imports. get_customer_balance also still matched 'pending'.

-- 1. Fix get_customer_balance to match awaiting_confirmation opening balances
CREATE OR REPLACE FUNCTION get_customer_balance(p_merchant_id UUID, p_customer_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  SELECT COALESCE(SUM(
    CASE WHEN type = 'debit' THEN amount ELSE -amount END
  ), 0) INTO v_balance
  FROM credit_logs
  WHERE merchant_id = p_merchant_id
    AND customer_id = p_customer_id
    AND (status = 'approved' OR (status = 'awaiting_confirmation' AND description LIKE 'Opening Balance%'))
    AND type != 'cash';
  RETURN v_balance;
END;
$$;

-- 2. Fix import_customers to use the merged status
CREATE OR REPLACE FUNCTION import_customers(p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  item JSONB;
  v_customer_id UUID;
  v_log_id UUID;
  v_results JSONB[] := '{}';
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_payload)
  LOOP
    -- Upsert customer by phone
    INSERT INTO customers (phone, name)
    VALUES (item->>'phone', item->>'name')
    ON CONFLICT (phone) DO UPDATE SET name = COALESCE(customers.name, EXCLUDED.name)
    RETURNING id INTO v_customer_id;

    -- Upsert merchant_customer junction with nickname
    INSERT INTO merchant_customers (merchant_id, customer_id, nickname)
    VALUES ((item->>'merchant_id')::UUID, v_customer_id, item->>'name')
    ON CONFLICT (merchant_id, customer_id) DO UPDATE SET nickname = EXCLUDED.nickname;

    -- Insert credit_log with status = 'awaiting_confirmation', description = 'Opening Balance (Excel Imported)'
    INSERT INTO credit_logs (merchant_id, customer_id, amount, type, status, description, initiated_by)
    VALUES (
      (item->>'merchant_id')::UUID,
      v_customer_id,
      (item->>'amount')::NUMERIC,
      'debit',
      'awaiting_confirmation',
      'Opening Balance (Excel Imported)',
      'merchant'
    )
    RETURNING id INTO v_log_id;

    -- If a short_code was provided, insert the short_link atomically
    IF item ? 'short_code' AND item->>'short_code' IS NOT NULL AND item->>'short_code' != '' THEN
      INSERT INTO short_links (code, destination_url)
      VALUES (item->>'short_code', '/customer/verify?log_id=' || v_log_id::TEXT);
    END IF;

    v_results := array_append(v_results, jsonb_build_object(
      'phone', item->>'phone',
      'customer_id', v_customer_id,
      'log_id', v_log_id
    ));
  END LOOP;

  RETURN jsonb_build_array(variadic v_results);
END;
$$;
