-- Migration 033: Atomic SMS balance increment function
-- Used after successful eSewa payment verification

CREATE OR REPLACE FUNCTION increment_sms_balance(p_merchant_id UUID, p_amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE merchants
  SET sms_balance = COALESCE(sms_balance, 0) + p_amount
  WHERE id = p_merchant_id;
END;
$$;
