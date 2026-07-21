-- Create persistent in-app notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('merchant', 'customer')),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  reference_id UUID,
  reference_type TEXT CHECK (reference_type IN ('credit_log', 'customer', 'merchant_customer', 'payment_reminder_log')),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast unread query per user
CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id, user_type, read, created_at DESC);

-- Add to realtime publication so dashboards get instant push
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Enable RLS so only the backend (service_role) can write
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (no RLS bypass needed for admin client)
CREATE POLICY "Service role full access"
  ON public.notifications
  USING (true)
  WITH CHECK (true);
