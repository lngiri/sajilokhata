import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Admin Supabase client using service-role key (bypasses RLS).
 * Returns `any`-typed client to avoid supabase-js v2.110 type inference
 * bugs (the PostgrestQueryBuilder `update`/`insert`/`upsert` methods
 * resolve to `never` with both typed and untyped clients).
 * 
 * Result types are explicitly annotated with Database["public"]["Tables"]
 * types at each call site for type safety.
 */
let adminClient: ReturnType<typeof createClient> | null = null;

export function getAdminClient() {
  if (adminClient) return adminClient as any;

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

  return adminClient as any;
}
