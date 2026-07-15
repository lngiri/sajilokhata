/**
 * Admin Seeder — ensures at least one admin user exists in the database.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL   — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — Service role key (bypasses RLS)
 *
 * Idempotent — safe to run multiple times.
 */

import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  // Check if admin already exists
  const { data: existing } = await (admin.from("admins") as any)
    .select("id")
    .eq("email", "lngiri@gmail.com")
    .maybeSingle();

  if (existing) {
    console.log("Admin already exists with id:", existing.id);
    process.exit(0);
  }

  // Insert the admin user
  const { data: newAdmin, error: insertError } = await (admin.from("admins") as any)
    .insert({ email: "lngiri@gmail.com", name: "Admin" })
    .select("id")
    .single();

  if (insertError) {
    // If table doesn't exist, guide user to run the migration first
    if (insertError.code === "42P01") {
      console.error("The 'admins' table does not exist. Run migration 022 first:");
      console.error("  1. Open your Supabase SQL Editor");
      console.error("  2. Paste and run supabase/migrations/022_ensure_admin_users.sql");
      process.exit(1);
    }
    console.error("Failed to seed admin:", insertError.message);
    process.exit(1);
  }

  console.log("Admin created with id:", newAdmin.id);
  console.log("Done — you can now log in at /admin/login with email 'lngiri@gmail.com'");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
