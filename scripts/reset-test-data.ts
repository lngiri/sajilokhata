/**
 * QR Hisab — QA / Test Data Reset
 *
 * Deletes ALL user-generated & business/test data from the database,
 * storage, and auth — while preserving the schema, migrations, RLS,
 * triggers, functions, indexes, admin accounts, app_settings, and
 * branding assets.
 *
 * After reset the application behaves like a fresh deployment with
 * zero merchants, zero customers, zero credit logs, zero invitations,
 * zero sessions, and zero user-uploaded files. The admin account
 * (lngiri@gmail.com) and all application configuration remain intact.
 *
 * Usage:
 *   npx tsx scripts/reset-test-data.ts
 *   npx tsx scripts/reset-test-data.ts --dry-run     # Preview only
 *   npx tsx scripts/reset-test-data.ts --verify       # Post-wipe verification only
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

// ── Business tables to wipe (dependency order: children first) ─
const BUSINESS_TABLES = [
  // Leaf tables / children (no remaining dependents)
  "audit_logs",
  "payment_reminder_logs",
  "sms_recharge_logs",
  "sms_requests",
  "merchant_ai_usage",
  "merchant_reminder_settings",
  "merchant_payment_methods",
  "merchant_products",
  "credit_log_items",
  "sessions",
  "customer_invites",
  "credit_logs",
  "merchant_customers",
  // No-FK tables
  "rate_limits",
  "notifications",
  "short_links",
  // Root parents (last)
  "customers",
  "merchants",
];

// ── Tables that MUST remain untouched ──────────────────────────
const PRESERVED_TABLES = ["admins", "app_settings"];

// ── All tables for verification (business + preserved) ─────────
const ALL_TABLES_FOR_VERIFICATION = [
  ...BUSINESS_TABLES,
  ...PRESERVED_TABLES,
];

// ── Storage buckets ────────────────────────────────────────────
const USER_BUCKETS = [
  { bucket: "app_assets", userPrefixes: null, skipPrefixes: ["branding"] },
  { bucket: "transaction_attachments", userPrefixes: null, skipPrefixes: [] },
  { bucket: "payment-proofs", userPrefixes: null, skipPrefixes: [] },
];

const ADMIN_EMAIL = "lngiri@gmail.com";

// ── Auth Users (delete all except the admin account) ───────────
async function deleteNonAdminAuthUsers(supabase: ReturnType<typeof createClient>) {
  console.log("\n=== 🔐 Deleting Non-Admin Auth Users ===\n");

  let page = 1;
  const perPage = 100;
  let totalDeleted = 0;
  let totalSkipped = 0;

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
      if (user.email === ADMIN_EMAIL) {
        totalSkipped++;
        console.log(`  ⏭️  Skipping admin user: ${user.email}`);
        continue;
      }
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
  console.log(`  Total admin users preserved: ${totalSkipped}`);
  return { deleted: totalDeleted, preserved: totalSkipped };
}

// ── Storage (delete only user-generated prefixes) ──────────────
async function listAllPaths(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  const { data: entries, error } = await supabase
    .storage
    .from(bucket)
    .list(prefix, { limit: 1000 });

  if (error) throw error;
  if (!entries) return paths;

  for (const entry of entries) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      // It's a folder — recurse
      const nested = await listAllPaths(supabase, bucket, fullPath);
      paths.push(...nested);
    } else {
      // It's a file
      paths.push(fullPath);
    }
  }
  return paths;
}

async function deleteUserStorageObjects(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  prefixes: string[] | null,
  skipPrefixes: string[],
) {
  console.log(`\n=== 📦 Clearing user files from bucket: ${bucket} ===`);

  try {
    let totalDeleted = 0;

    if (prefixes === null) {
      // Recursive full-bucket clear (respect skipPrefixes)
      const allPaths = await listAllPaths(supabase, bucket, "");
      const filtered = allPaths.filter((p) =>
        !skipPrefixes.some((skip) => p === skip || p.startsWith(skip + "/")),
      );
      if (filtered.length === 0) {
        console.log("  (empty — nothing to delete)");
        return 0;
      }
      if (skipPrefixes.length > 0) {
        console.log(`  ⏭️  Preserving ${allPaths.length - filtered.length} file(s) under: ${skipPrefixes.join(", ")}`);
      }
      const { error: delErr } = await supabase
        .storage
        .from(bucket)
        .remove(filtered);
      if (delErr) {
        console.error(`  ❌ Failed to delete files: ${delErr.message}`);
      } else {
        console.log(`  ✅ Deleted ${filtered.length} file(s) recursively`);
        totalDeleted = filtered.length;
      }
      return totalDeleted;
    }

    // Prefix-based deletion (selective user content in shared bucket)
    for (const prefix of prefixes) {
      if (skipPrefixes.includes(prefix)) {
        console.log(`  ⏭️  Preserving prefix: "${prefix || "/"}"`);
        continue;
      }

      const allPaths = await listAllPaths(supabase, bucket, prefix);
      if (allPaths.length === 0) {
        console.log(`  (empty — nothing to delete in "${prefix || "/"}")`);
        continue;
      }
      const { error: delErr } = await supabase
        .storage
        .from(bucket)
        .remove(allPaths);
      if (delErr) {
        console.error(`  ❌ Failed to delete from "${prefix || "/"}": ${delErr.message}`);
      } else {
        console.log(`  ✅ Deleted ${allPaths.length} file(s) from "${prefix || "/"}"`);
        totalDeleted += allPaths.length;
      }
    }

    if (totalDeleted === 0) {
      console.log("  (nothing to delete)");
    }
    return totalDeleted;
  } catch (e: any) {
    console.error(`  ⚠️  Storage clear skipped: ${e.message}`);
    return 0;
  }
}

// ── Table Delete ───────────────────────────────────────────────
async function deleteTableRows(
  supabase: ReturnType<typeof createClient>,
  tableName: string,
): Promise<{ before: number; after: number; error?: string }> {
  // Count before
  const { count: before } = await supabase
    .from(tableName)
    .select("*", { count: "exact", head: true });

  let delError: string | undefined;

  // Delete all rows via Supabase JS API
  try {
    const { error: delErr } = await (supabase.from(tableName) as any)
      .delete()
      .not("id", "is", null);

    if (delErr) {
      // Some tables may use a different PK column name
      const { error: e2 } = await (supabase.from(tableName) as any)
        .delete()
        .not("key", "is", null);

      if (e2) {
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

// ── Row Count Helper ──────────────────────────────────────────
async function getRowCount(supabase: ReturnType<typeof createClient>, table: string): Promise<number> {
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

// ── Main ──────────────────────────────────────────────────────
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
  console.log("║   QR Hisab — QA Test Data Reset          ║");
  console.log("║   Deletes business data only              ║");
  console.log("║   Preserves schema, config, admin         ║");
  console.log("╚══════════════════════════════════════════╝\n");
  console.log(`Target: ${url}`);
  console.log(`Mode:   ${dryRun ? "DRY RUN (preview only)" : verifyOnly ? "VERIFY ONLY" : "LIVE RESET"}\n`);

  // ── Health check ──
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

  // ── Verify only mode ──
  if (verifyOnly) {
    console.log("═══ Verification: Row Counts ═══\n");
    for (const name of ALL_TABLES_FOR_VERIFICATION) {
      const count = await getRowCount(supabase, name);
      const status = count === 0 ? "✅" : "❌";
      console.log(`  ${name.padEnd(30)} ${count} row(s)  ${status}`);
    }

    console.log("\n═══ Storage: File Counts ═══\n");
    for (const { bucket } of USER_BUCKETS) {
      try {
        const allPaths = await listAllPaths(supabase, bucket, "");
        console.log(`  ${bucket.padEnd(30)} ${allPaths.length} file(s) (all user-generated)`);
      } catch {
        console.log(`  ${bucket.padEnd(30)} —`);
      }
    }

    console.log("\n═══ Auth: User Counts ═══\n");
    const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const adminCount = users?.users?.filter((u) => u.email === ADMIN_EMAIL).length ?? 0;
    const otherCount = (users?.users?.length ?? 0) - adminCount;
    console.log(`  Admin accounts: ${adminCount}`);
    console.log(`  Non-admin accounts: ${otherCount}`);
    return;
  }

  // ═══════════════════════════════════════════
  // STEP 1: Pre-reset counts
  // ═══════════════════════════════════════════
  console.log("═══ Step 1: Pre-Reset Counts (Business Tables) ═══\n");
  for (const name of BUSINESS_TABLES) {
    const count = await getRowCount(supabase, name);
    console.log(`  ${name.padEnd(30)} ${count} row(s)`);
  }

  console.log("\n═══ Preserved Tables (not modified) ═══\n");
  for (const name of PRESERVED_TABLES) {
    const count = await getRowCount(supabase, name);
    console.log(`  ${name.padEnd(30)} ${count} row(s)  🔒`);
  }

  if (dryRun) {
    console.log("\n═══ Storage Preview ═══\n");
    for (const { bucket, userPrefixes, skipPrefixes } of USER_BUCKETS) {
      if (userPrefixes === null) {
        try {
          const allPaths = await listAllPaths(supabase, bucket, "");
          const filtered = allPaths.filter((p) =>
            !skipPrefixes.some((skip) => p === skip || p.startsWith(skip + "/")),
          );
          const preserved = allPaths.length - filtered.length;
          const skipMsg = preserved > 0 ? ` (${preserved} preserved under ${skipPrefixes.join(", ")})` : "";
          console.log(`  ${bucket}  (recursive clear) — ${filtered.length} file(s) to delete${skipMsg}`);
        } catch {
          console.log(`  ${bucket}  —`);
        }
        continue;
      }
      for (const prefix of userPrefixes) {
        if (skipPrefixes.includes(prefix)) {
          console.log(`  ${bucket}/${prefix || "(root)"}  ⏭️  (preserved)`);
          continue;
        }
        try {
          const allPaths = await listAllPaths(supabase, bucket, prefix);
          const count = allPaths.length;
          const label = prefix || "(root)";
          console.log(`  ${bucket}/${label.padEnd(25)} ${count} file(s) to delete`);
        } catch {
          console.log(`  ${bucket}/${prefix || "(root)"}  —`);
        }
      }
    }

    console.log("\n═══ Auth Users Preview ═══\n");
    const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const toDelete = users?.users?.filter((u) => u.email !== ADMIN_EMAIL) ?? [];
    const preserved = users?.users?.filter((u) => u.email === ADMIN_EMAIL) ?? [];
    console.log(`  Admin accounts to preserve: ${preserved.length}`);
    console.log(`  Non-admin accounts to delete: ${toDelete.length}`);
    for (const u of toDelete) {
      console.log(`    ⛔ ${u.email || u.phone || u.id}`);
    }

    console.log("\n🔍 Dry run complete. No data was modified.");
    return;
  }

  // ═══════════════════════════════════════════
  // STEP 2: Confirm
  // ═══════════════════════════════════════════
  console.log("\n⚠️  WARNING: This will DELETE ALL BUSINESS DATA!");
  console.log("   The following WILL be deleted:");
  console.log("   - All merchants, customers, credit logs");
  console.log("   - All invitations, sessions, notifications");
  console.log("   - All SMS & payment records");
  console.log("   - All non-admin auth users");
  console.log("   - All merchant photos, customer avatars, payment QR images");
  console.log("   - All transaction attachments & payment proofs");
  console.log("\n   The following will be PRESERVED:");
  console.log("   - Database schema, migrations, indexes, constraints");
  console.log("   - RLS policies, triggers, functions");
  console.log("   - admins table & admin account (lngiri@gmail.com)");
  console.log("   - app_settings (branding, CMS, announcements)");
  console.log("   - Branding assets in app_assets/branding/");
  console.log("\n   Proceeding in 2 seconds... (Ctrl+C to abort)\n");
  await new Promise((r) => setTimeout(r, 2000));

  // ═══════════════════════════════════════════
  // STEP 3: Delete business table rows
  // ═══════════════════════════════════════════
  console.log("═══ Step 2: Deleting Business Data ═══\n");

  for (const name of BUSINESS_TABLES) {
    const r = await deleteTableRows(supabase, name);
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
  // STEP 4: Delete user-generated storage objects
  // ═══════════════════════════════════════════
  console.log("\n═══ Step 3: Clearing User-Uploaded Storage Files ═══\n");

  for (const { bucket, userPrefixes, skipPrefixes } of USER_BUCKETS) {
    await deleteUserStorageObjects(supabase, bucket, userPrefixes, skipPrefixes);
  }

  // ═══════════════════════════════════════════
  // STEP 5: Delete non-admin auth users
  // ═══════════════════════════════════════════
  await deleteNonAdminAuthUsers(supabase);

  // ═══════════════════════════════════════════
  // STEP 6: Refresh materialized views
  // ═══════════════════════════════════════════
  await refreshMaterializedViews(supabase);

  // ═══════════════════════════════════════════
  // STEP 7: Post-reset verification
  // ═══════════════════════════════════════════
  console.log("\n═══ Step 4: Post-Reset Verification ═══\n");

  let allBusinessClean = true;
  console.log("  ── Business Tables ──\n");
  for (const name of BUSINESS_TABLES) {
    const count = await getRowCount(supabase, name);
    const clean = count === 0;
    if (!clean) allBusinessClean = false;
    console.log(`  ${name.padEnd(30)} ${count} row(s)  ${clean ? "✅" : "❌ NOT EMPTY"}`);
  }

  console.log("\n  ── Preserved Tables ──\n");
  let allPreservedPresent = true;
  for (const name of PRESERVED_TABLES) {
    const count = await getRowCount(supabase, name);
    if (name === "app_settings") {
      // app_settings can legitimately be empty — just report
      console.log(`  ${name.padEnd(30)} ${count} row(s)  🔒`);
    } else {
      const present = count > 0;
      if (!present) allPreservedPresent = false;
      console.log(`  ${name.padEnd(30)} ${count} row(s)  ${present ? "✅ preserved" : "❌ EMPTY!"}`);
    }
  }

  // ═══════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════
  console.log("\n" + "═".repeat(55));
  if (allBusinessClean && allPreservedPresent) {
    console.log("✅ QA TEST DATA RESET COMPLETE");
    console.log("   All business tables are empty.");
    console.log("   Admin account & app configuration intact.");
    console.log("   User-uploaded storage files cleared.");
    console.log("   Schema, migrations, RLS, functions preserved.");
  } else if (allBusinessClean && !allPreservedPresent) {
    console.log("⚠️  Business data cleared, but preserved tables may be missing data.");
    console.log("   Run `scripts/seed-admin.ts` to restore the admin account.");
  } else {
    console.log("⚠️  RESET INCOMPLETE — Some business tables still have data.");
    console.log("   You may need to check RLS policies or run the delete manually.");
  }
  console.log("═".repeat(55));
}

main().catch((e) => {
  console.error("❌ Fatal error:", e);
  process.exit(1);
});
