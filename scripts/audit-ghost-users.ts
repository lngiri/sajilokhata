/**
 * Audit Ghost Users — finds incomplete registrations.
 *
 * Ghost = row in merchants OR customers with pin_hash IS NULL
 * (i.e. OTP verified but PIN was never set → incomplete flow).
 *
 * Usage (dry-run):
 *   npx tsx scripts/audit-ghost-users.ts
 *
 * Usage (delete):
 *   npx tsx scripts/audit-ghost-users.ts --delete
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const shouldDelete = process.argv.includes("--delete");

  if (!url || !key) {
    console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  console.log("=== Ghost User Audit ===");
  console.log(`Mode: ${shouldDelete ? "DELETE" : "DRY-RUN (read-only)"}`);
  console.log("");

  // ── Check which columns exist ──
  const checkColumn = async (table: string, col: string): Promise<boolean> => {
    const { data, error } = await admin.rpc("exec_sql" as any, {
      query: `SELECT column_name FROM information_schema.columns WHERE table_name='${table}' AND column_name='${col}'`,
    });
    // If RPC doesn't exist, just try selecting and catch
    if (error) {
      // Fallback: try selecting the column
      const { error: selErr } = await (admin.from(table) as any).select(col).limit(1);
      return !selErr;
    }
    return (data as any)?.length > 0;
  };

  let hasMerchantPin = false;
  let hasCustomerPin = false;

  try {
    const { error: mErr } = await (admin.from("merchants") as any).select("pin_hash").limit(1);
    hasMerchantPin = !mErr;
  } catch { hasMerchantPin = false; }

  try {
    const { error: cErr } = await (admin.from("customers") as any).select("pin_hash").limit(1);
    hasCustomerPin = !cErr;
  } catch { hasCustomerPin = false; }

  console.log(`pin_hash column exists: merchants=${hasMerchantPin}, customers=${hasCustomerPin}`);
  console.log("");

  // ── Total counts in each table ──
  const { count: totalMerchants, error: tmErr } = await (admin.from("merchants") as any)
    .select("*", { count: "exact", head: true });

  const { count: totalCustomers, error: tcErr } = await (admin.from("customers") as any)
    .select("*", { count: "exact", head: true });

  if (tmErr) { console.error("Error counting merchants:", tmErr); process.exit(1); }
  if (tcErr) { console.error("Error counting customers:", tcErr); process.exit(1); }

  console.log(`Total rows: merchants=${totalMerchants}, customers=${totalCustomers}`);
  console.log("");

  // ── Query merchants with no PIN ──
  let merchants: any[] = [];
  if (hasMerchantPin) {
    const { data, error } = await (admin.from("merchants") as any)
      .select("id, name, phone, business_type, business_name, created_at, pin_hash")
      .is("pin_hash", null)
      .order("created_at", { ascending: false });

    if (error) { console.error("Error querying merchants:", error); process.exit(1); }
    merchants = data || [];
  } else {
    // No pin_hash column — can't identify ghosts by PIN
    console.log("(merchants: pin_hash column missing — ghost detection unavailable)");
  }

  console.log(`Merchants with NULL pin_hash: ${merchants.length}`);
  for (const m of merchants) {
    console.log(`  [merchant] id=${m.id} phone=${m.phone} name=${m.name} created_at=${m.created_at}`);
  }

  // ── Query customers with no PIN ──
  let customers: any[] = [];
  if (hasCustomerPin) {
    const { data, error } = await (admin.from("customers") as any)
      .select("id, name, phone, created_at, pin_hash")
      .is("pin_hash", null)
      .order("created_at", { ascending: false });

    if (error) { console.error("Error querying customers:", error); process.exit(1); }
    customers = data || [];
  } else {
    console.log("(customers: pin_hash column missing — ghost detection unavailable)");
  }

  console.log(`\nCustomers with NULL pin_hash: ${customers.length}`);
  for (const c of customers) {
    console.log(`  [customer] id=${c.id} phone=${c.phone} name=${c.name} created_at=${c.created_at}`);
  }

  const total = merchants.length + customers.length;
  console.log(`\nTotal ghost records: ${total}`);

  // ── Also list ALL rows in both tables (for manual inspection) ──
  console.log("\n--- All merchants ---");
  const { data: allMerchants } = await (admin.from("merchants") as any)
    .select("id, name, phone, business_type, business_name, pin_hash, created_at")
    .order("created_at", { ascending: false });
  for (const m of allMerchants || []) {
    const pinStatus = hasMerchantPin ? (m.pin_hash ? "HAS_PIN" : "NO_PIN") : "N/A";
    console.log(`  id=${m.id} phone=${m.phone} name=${m.name} ${pinStatus} created_at=${m.created_at}`);
  }

  console.log("\n--- All customers ---");
  const { data: allCustomers } = await (admin.from("customers") as any)
    .select("id, name, phone, created_at")
    .order("created_at", { ascending: false });
  for (const c of allCustomers || []) {
    console.log(`  id=${c.id} phone=${c.phone} name=${c.name} created_at=${c.created_at}`);
  }

  // ── Confirm + Delete ──
  if (total === 0) {
    console.log("\nNo ghost users found. Nothing to clean up.");
    process.exit(0);
  }

  if (!shouldDelete) {
    console.log("\nTo delete these records, re-run with: --delete");
    console.log("  npx tsx scripts/audit-ghost-users.ts --delete");
    process.exit(0);
  }

  // ── DELETE ──
  console.log("\n--- Deleting ghost records ---");

  if (hasMerchantPin && merchants.length) {
    const ids = merchants.map((m: any) => m.id);
    const { error: delErr } = await (admin.from("merchants") as any)
      .delete()
      .in("id", ids);
    if (delErr) console.error("Error deleting merchants:", delErr);
    else console.log(`Deleted ${ids.length} merchant(s)`);
  }

  if (hasCustomerPin && customers.length) {
    const ids = customers.map((c: any) => c.id);
    const { error: delErr } = await (admin.from("customers") as any)
      .delete()
      .in("id", ids);
    if (delErr) console.error("Error deleting customers:", delErr);
    else console.log(`Deleted ${ids.length} customer(s)`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
