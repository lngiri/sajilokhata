import { createClient } from "@supabase/supabase-js";

/**
 * Supabase admin client (server-side only).
 * Uses the SERVICE_ROLE key to bypass RLS and manage users.
 * Only import and call this from Server Components, Route Handlers, or Server Actions.
 */
let adminClient: ReturnType<typeof createClient> | null = null;

export function getAdminClient() {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
