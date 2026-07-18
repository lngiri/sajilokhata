-- Migration 042: Distributed rate limiting table
-- Replaces in-memory Map for horizontal scalability across Vercel instances

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No public access — only the service_role key touches this table
CREATE POLICY "service_role_only" ON public.rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
