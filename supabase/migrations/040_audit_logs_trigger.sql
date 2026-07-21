-- Migration 040: Refactor audit_logs with trigger-based logging

-- 1. Safely DROP old audit_logs table and its dependent type
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TYPE IF EXISTS public.audit_action CASCADE;

-- 2. Create new generalized audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('merchant', 'customer', 'system')),
  action_type TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB
);

-- 3. Create trigger function with scoped actor handling
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_type TEXT;
  v_action_type TEXT;
  v_merchant_id UUID;
  v_record_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_merchant_id := OLD.merchant_id;
    v_record_id := OLD.id;
    v_actor_id := COALESCE(auth.uid(), OLD.merchant_id, OLD.customer_id);
    v_actor_type := CASE
      WHEN auth.uid() IS NOT NULL THEN 'merchant'
      WHEN OLD.initiated_by = 'customer' THEN 'customer'
      ELSE 'merchant'
    END;
    v_action_type := 'deleted';
  ELSE
    v_merchant_id := NEW.merchant_id;
    v_record_id := NEW.id;
    v_actor_id := COALESCE(auth.uid(), NEW.merchant_id, NEW.customer_id);
    v_actor_type := CASE
      WHEN auth.uid() IS NOT NULL THEN 'merchant'
      WHEN NEW.initiated_by = 'customer' THEN 'customer'
      ELSE 'merchant'
    END;

    IF TG_OP = 'INSERT' THEN
      v_action_type := 'created';
    ELSE
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF NEW.status = 'approved' AND OLD.status = 'edit_requested'
           AND OLD.amount IS DISTINCT FROM NEW.amount THEN
          v_action_type := 'edit_accepted';
        ELSIF NEW.status = 'approved' THEN
          v_action_type := 'approved';
        ELSIF NEW.status = 'disputed' THEN
          v_action_type := 'disputed';
        ELSIF NEW.status = 'rejected' THEN
          v_action_type := 'rejected';
        ELSIF NEW.status = 'edit_requested' THEN
          v_action_type := 'edit_requested';
        ELSIF OLD.status = 'edit_requested' AND NEW.status = 'unverified' THEN
          v_action_type := 'edit_rejected';
        ELSE
          v_action_type := 'status_changed';
        END IF;
      ELSIF OLD.amount IS DISTINCT FROM NEW.amount THEN
        v_action_type := 'modified';
      ELSE
        v_action_type := 'modified';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (merchant_id, actor_id, actor_type, action_type, table_name, record_id, old_data, new_data)
  VALUES (
    v_merchant_id,
    v_actor_id,
    v_actor_type,
    v_action_type,
    TG_TABLE_NAME,
    v_record_id,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4. Bind trigger to credit_logs
DROP TRIGGER IF EXISTS audit_credit_logs_trigger ON public.credit_logs;
CREATE TRIGGER audit_credit_logs_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.credit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.process_audit_log();

-- 5. RLS: merchants SELECT only their own logs; client writes blocked
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchants_select_own_audit_logs" ON public.audit_logs;
CREATE POLICY "merchants_select_own_audit_logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (merchant_id = auth.uid());

DROP POLICY IF EXISTS "block_client_write_audit_logs" ON public.audit_logs;
CREATE POLICY "block_client_write_audit_logs"
  ON public.audit_logs
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 6. Grants
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT INSERT ON public.audit_logs TO service_role;
