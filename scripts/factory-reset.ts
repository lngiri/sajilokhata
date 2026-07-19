/**
 * QR Hisab — Complete Factory Reset
 *
 * Wipes ALL data from the Supabase database, storage buckets, and auth users.
 * Keeps table schemas, triggers, RLS policies, and functions intact.
 *
 * Usage:
 *   npx tsx scripts/factory-reset.ts
 *   npx tsx scripts/factory-reset.ts --dry-run     # Preview only
 *   npx tsx scripts/factory-reset.ts --verify       # Post-wipe verification only
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

// ── All tables in dependency order (children first) ──────────
const TABLES_IN_ORDER = [
  // Leaf tables (no children depend on them)
  "audit_logs",
  "idempotency_keys",
  "rate_limits",
  "payment_reminder_logs",
  "sms_recharge_logs",
  "sms_requests",
  "transaction_attachments",
  "merchant_ai_usage",
  "merchant_reminder_settings",
  "merchant_payment_methods",
  "sessions",
  "credit_logs",
  "merchant_customers",
  "customers",
  "merchants",
  "admins",
  "app_settings",
];

// Storage buckets to empty
const STORAGE_BUCKETS = ["app_assets"];

// ── Auth Users ───────────────────────────────────────────────
async function wipeAuthUsers(supabase: ReturnType<typeof createClient>) {
  console.log("\n=== 🔐 Wiping Auth Users ===\n");

  let page = 1;
  const perPage = 100;
  let totalDeleted = 0;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error(`  ❌ Failed to list users: ${error.message}`);
      break;
    }

    const users = data?.users;
    if (!users || users.length === 0) break;

    for (const user of users) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
      if (delErr) {
        console.error(`  ❌ Failed to delete user ${user.id} (${user.phone || user.email}): ${delErr.message}`);
      } else {
        totalDeleted++;
        console.log(`  ✅ Deleted auth user: ${user.phone || user.email || user.id}`);
      }
    }

    if (users.length < perPage) break;
    page++;
  }

  console.log(`\n  Total auth users deleted: ${totalDeleted}`);
  return totalDeleted;
}

// ── Storage Bucket ───────────────────────────────────────────
async function wipeStorageBucket(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
) {
  console.log(`\n=== 📦 Wiping Storage Bucket: ${bucket} ===\n`);

  try {
    let totalDeleted = 0;

    // List files in root and known subdirectories
    const prefixes = ["", "merchant-photos", "customer-avatars", "payment-qr", "sms-attachments"];

    for (const prefix of prefixes) {
      const { data: files, error: listErr } = await supabase
        .storage
        .from(bucket)
        .list(prefix, { limit: 1000 });

      if (listErr || !files || files.length === 0) continue;

      const filePaths = files.map((f) => prefix ? `${prefix}/${f.name}` : f.name);
      const { error: delErr } = await supabase
        .storage
        .from(bucket)
        .remove(filePaths);

      if (delErr) {
        console.error(`  ❌ Failed to delete from "${prefix || "/"}": ${delErr.message}`);
      } else {
        console.log(`  ✅ Deleted ${filePaths.length} file(s) from "${prefix || "/"}"`);
        totalDeleted += filePaths.length;
      }
    }

    if (totalDeleted === 0) {
      console.log("  (empty — nothing to delete)");
    }
    return totalDeleted;
  } catch (e: any) {
    console.error(`  ⚠️  Storage wipe skipped: ${e.message}`);
    return 0;
  }
}

// ── Table Wipe ───────────────────────────────────────────────
async function wipeTable(
  supabase: ReturnType<typeof createClient>,
  tableName: string,
): Promise<{ before: number; after: number; error?: string }> {
  // Count before
  const { count: before } = await supabase
    .from(tableName)
    .select("*", { count: "exact", head: true });

  let delError: string | undefined;

  // Delete all rows — Supabase JS requires a filter.
  // "not id is null" matches all rows with an id column.
  try {
    const { error: delErr } = await (supabase.from(tableName) as any)
      .delete()
      .not("id", "is", null);

    if (delErr) {
      // Some tables (like app_settings) use "key" as PK instead of "id"
      const { error: e2 } = await (supabase.from(tableName) as any)
        .delete()
        .not("key", "is", null);

      if (e2) {
        // Check if table doesn't exist
        if (delErr.message?.includes("does not exist") || e2.message?.includes("does not exist")) {
          delError = "table not found";
        } else {
          delError = delErr.message;
        }
      }
    }
  } catch (e: any) {
    if (e?.message?.includes("does not exist")) {
      delError = "table not found";
    } else {
      delError = e?.message || "unknown error";
    }
  }

  // Count after
  const { count: after } = await supabase
    .from(tableName)
    .select("*", { count: "exact", head: true });

  return {
    before: before ?? 0,
    after: after ?? 0,
    error: delError,
  };
}

// ── Materialized Views ───────────────────────────────────────
async function refreshMaterializedViews(supabase: ReturnType<typeof createClient>) {
  console.log("\n=== 🔄 Refreshing Materialized Views ===\n");
  try {
    const { error } = await supabase.rpc("refresh_customer_summary" as any);
    if (error) {
      console.log(`  ⚠️  RPC refresh failed: ${error.message} — views will auto-refresh on next access`);
    } else {
      console.log("  ✅ customer_summary refreshed");
    }
  } catch {
    console.log("  ⚠️  Materialized view refresh skipped (will refresh on next query)");
  }
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const verifyOnly = args.includes("--verify");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("❌ Missing environment variables:");
    console.error("   NEXT_PUBLIC_SUPABASE_URL");
    console.error("   SUPABASE_SERVICE_ROLE_KEY");
    console.error("\nSet them in .env or export before running.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  console.log("╔══════════════════════════════════════════╗");
  console.log("║   QR Hisab — Factory Reset               ║");
  console.log("║   Wipes all data, keeps schemas intact    ║");
  console.log("╚══════════════════════════════════════════╝\n");
  console.log(`Target: ${url}`);
  console.log(`Mode:   ${dryRun ? "DRY RUN (preview only)" : verifyOnly ? "VERIFY ONLY" : "LIVE WIPE"}\n`);

  // ── Health check: verify credentials work ──
  if (!verifyOnly) {
    console.log("═══ Health Check ═══\n");
    try {
      const { error } = await supabase.from("merchants").select("id").limit(1);
      if (error) {
        console.error(`  ❌ Cannot connect to database: ${error.message}`);
        console.error("  Check your NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
        process.exit(1);
      }
      console.log("  ✅ Credentials valid — connected to Supabase\n");
    } catch (e: any) {
      console.error(`  ❌ Connection failed: ${e.message}`);
      process.exit(1);
    }
  }

  if (verifyOnly) {
    console.log("═══ Verification: Row Counts ═══\n");
    for (const name of TABLES_IN_ORDER) {
      const { count } = await supabase
        .from(name)
        .select("*", { count: "exact", head: true });
      const status = count === 0 ? "✅" : "❌";
      console.log(`  ${name.padEnd(30)} ${count ?? "?"} row(s)  ${status}`);
    }
    return;
  }

  // ═══════════════════════════════════════════
  // STEP 1: Pre-wipe counts
  // ═══════════════════════════════════════════
  console.log("═══ Step 1: Pre-Wipe Counts ═══\n");
  for (const name of TABLES_IN_ORDER) {
    const { count } = await supabase
      .from(name)
      .select("*", { count: "exact", head: true });
    console.log(`  ${name.padEnd(30)} ${count ?? "?"} row(s)`);
  }

  if (dryRun) {
    console.log("\n🔍 Dry run complete. No data was modified.");
    return;
  }

  // ═══════════════════════════════════════════
  // STEP 2: Confirm with 2-second safety delay
  // ═══════════════════════════════════════════
  console.log("\n⚠️  WARNING: This will DELETE ALL DATA from the database!");
  console.log("   This includes: all merchants, customers, transactions, sessions, auth users, and stored files.");
  console.log("   Schemas, triggers, RLS policies, and functions will be preserved.\n");
  console.log("   Proceeding in 2 seconds... (Ctrl+C to abort)\n");
  await new Promise((r) => setTimeout(r, 2000));

  // ═══════════════════════════════════════════
  // STEP 3: Wipe database tables
  // ═══════════════════════════════════════════
  console.log("═══ Step 2: Wiping Database Tables ═══\n");

  for (const name of TABLES_IN_ORDER) {
    const r = await wipeTable(supabase, name);
    const status = r.error
      ? r.error === "table not found"
        ? "⏭️  (not found)"
        : `❌ ${r.error}`
      : r.after === 0
        ? "✅"
        : `⚠️  ${r.after} remaining`;
    console.log(`  ${name.padEnd(30)} ${r.before} → ${r.after}  ${status}`);
  }

  // ═══════════════════════════════════════════
  // STEP 4: Wipe storage
  // ═══════════════════════════════════════════
  console.log("\n═══ Step 3: Wiping Storage Buckets ═══\n");
  for (const bucket of STORAGE_BUCKETS) {
    await wipeStorageBucket(supabase, bucket);
  }

  // ═══════════════════════════════════════════
  // STEP 5: Wipe auth users
  // ═══════════════════════════════════════════
  await wipeAuthUsers(supabase);

  // ═══════════════════════════════════════════
  // STEP 6: Refresh materialized views
  // ═══════════════════════════════════════════
  await refreshMaterializedViews(supabase);

  // ═══════════════════════════════════════════
  // STEP 7: Post-wipe verification
  // ═══════════════════════════════════════════
  console.log("\n═══ Step 4: Post-Wipe Verification ═══\n");
  let allClean = true;
  for (const name of TABLES_IN_ORDER) {
    const { count } = await supabase
      .from(name)
      .select("*", { count: "exact", head: true });
    const clean = count === 0;
    if (!clean) allClean = false;
    console.log(`  ${name.padEnd(30)} ${count} row(s)  ${clean ? "✅" : "❌ NOT EMPTY"}`);
  }

  // ═══════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════
  console.log("\n" + "═".repeat(50));
  if (allClean) {
    console.log("✅ FACTORY RESET COMPLETE — All tables empty, schemas intact.");
  } else {
    console.log("⚠️  RESET INCOMPLETE — Some tables still have data.");
    console.log("   You may need to check RLS policies or run the wipe manually.");
  }
  console.log("═".repeat(50));
}

main().catch((e) => {
  console.error("❌ Fatal error:", e);
  process.exit(1);
});
