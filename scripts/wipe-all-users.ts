/**
 * Wipe ALL user data for a fresh start.
 *
 * Deletes in dependency order so FK constraints don't block.
 *
 * Usage:
 *   npx tsx scripts/wipe-all-users.ts
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("Missing env vars"); process.exit(1); }

  const db = createClient(url, key, { auth: { persistSession: false } });

  // Delete in FK-safe order (children before parents)
  const tables = ["sessions", "credit_logs", "merchant_customers", "audit_logs", "customers", "merchants"];

  console.log("=== Wiping ALL user data ===");
  console.log("");

  // Pre-count
  for (const name of tables) {
    const { count } = await (db.from(name) as any).select("*", { count: "exact", head: true });
    console.log(`  ${name}: ${count} row(s)`);
  }

  console.log("");

  // Delete all rows from each table
  // Supabase JS client requires at least one filter; using "not id is null" matches all rows
  for (const name of tables) {
    const { error } = await (db.from(name) as any)
      .delete()
      .not("id", "is", null);

    if (error) {
      // Try with a different column for tables whose PK isn't "id"
      const { error: e2 } = await (db.from(name) as any)
        .delete()
        .not("merchant_id", "is", null);
      if (e2) {
        console.error(`  ${name}: FAILED — ${error.message} / ${e2.message}`);
      } else {
        console.log(`  ${name}: cleared`);
      }
    } else {
      console.log(`  ${name}: cleared`);
    }
  }

  // Post-count
  console.log("\n--- Post-wipe ---");
  for (const name of tables) {
    const { count } = await (db.from(name) as any).select("*", { count: "exact", head: true });
    console.log(`  ${name}: ${count} row(s)`);
  }

  console.log("\nDone. Fresh start ready.");
}

main().catch((e) => { console.error(e); process.exit(1); });
