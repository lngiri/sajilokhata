-- Migration 032: Atomic SMS balance decrement function
-- Used by the SMS credit guard after a successful Aakash SMS send

CREATE OR REPLACE FUNCTION decrement_sms_balance(p_merchant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE merchants
  SET sms_balance = GREATEST(sms_balance - 1, 0)
  WHERE id = p_merchant_id AND sms_balance > 0;
END;
$$;

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
