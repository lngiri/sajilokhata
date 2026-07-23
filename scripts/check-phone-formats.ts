/**
 * Diagnostic: Check actual phone formats in the database.
 * Run: npx tsx scripts/check-phone-formats.ts
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// Load env
const envRaw = readFileSync(".env", "utf-8");
const envLocalRaw = readFileSync(".env.local", "utf-8");
const env: Record<string, string> = {};
for (const block of [envRaw, envLocalRaw]) {
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
}

const url = env["NEXT_PUBLIC_SUPABASE_URL"];
const key = env["SUPABASE_SERVICE_ROLE_KEY"];

if (!url || !key) {
  console.error("❌ Missing env vars:", { url: !!url, key: !!key });
  process.exit(1);
}

console.log("✅ Supabase URL:", url);
console.log("✅ Service Role Key: SET (length:", key.length, ")");

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  PHONE FORMAT DIAGNOSTIC");
  console.log("═══════════════════════════════════════════\n");

  // 1. Merchants table
  const { data: merchants, error: mErr } = await (admin.from("merchants") as any)
    .select("id, phone, name")
    .order("created_at", { ascending: false })
    .limit(20);

  if (mErr) {
    console.error("❌ Error querying merchants:", mErr);
  } else {
    console.log(`📊 MERCHANTS (${merchants?.length || 0} rows):`);
    if (!merchants || merchants.length === 0) {
      console.log("   (empty — no merchants found)");
    } else {
      console.log("   ┌─────────────────────────────────────────────────────────┐");
      console.log("   │ Phone Format Analysis                                   │");
      console.log("   ├─────────────────────────────────────────────────────────┤");
      
      const formats: Record<string, number> = {};
      for (const m of merchants) {
        const phone = m.phone || "";
        let fmt: string;
        if (phone.startsWith("+977") && phone.length === 13) fmt = "+977XXXXXXXXX (13 chars)";
        else if (phone.startsWith("977") && phone.length === 13) fmt = "977XXXXXXXXX  (13 chars, no +)";
        else if (phone.length === 10) fmt = "XXXXXXXXXX   (10 digits)";
        else fmt = `OTHER: "${phone}" (${phone.length} chars)`;
        formats[fmt] = (formats[fmt] || 0) + 1;
        console.log(`   │ ${m.phone?.padEnd(20)} │ ${fmt.padEnd(35)} │`);
      }
      console.log("   └─────────────────────────────────────────────────────────┘");
      console.log("\n   Format distribution:");
      for (const [fmt, count] of Object.entries(formats)) {
        console.log(`     ${fmt}: ${count}`);
      }
    }
  }

  // 2. Customers table
  const { data: customers, error: cErr } = await (admin.from("customers") as any)
    .select("id, phone, name")
    .order("created_at", { ascending: false })
    .limit(20);

  if (cErr) {
    console.error("\n❌ Error querying customers:", cErr);
  } else {
    console.log(`\n📊 CUSTOMERS (${customers?.length || 0} rows):`);
    if (!customers || customers.length === 0) {
      console.log("   (empty — no customers found)");
    } else {
      console.log("   ┌─────────────────────────────────────────────────────────┐");
      console.log("   │ Phone Format Analysis                                   │");
      console.log("   ├─────────────────────────────────────────────────────────┤");
      
      const formats: Record<string, number> = {};
      for (const c of customers) {
        const phone = c.phone || "";
        let fmt: string;
        if (phone.startsWith("+977") && phone.length === 13) fmt = "+977XXXXXXXXX (13 chars)";
        else if (phone.startsWith("977") && phone.length === 13) fmt = "977XXXXXXXXX  (13 chars, no +)";
        else if (phone.length === 10) fmt = "XXXXXXXXXX   (10 digits)";
        else fmt = `OTHER: "${phone}" (${phone.length} chars)`;
        formats[fmt] = (formats[fmt] || 0) + 1;
        console.log(`   │ ${c.phone?.padEnd(20)} │ ${fmt.padEnd(35)} │`);
      }
      console.log("   └─────────────────────────────────────────────────────────┘");
      console.log("\n   Format distribution:");
      for (const [fmt, count] of Object.entries(formats)) {
        console.log(`     ${fmt}: ${count}`);
      }
    }
  }

  // 3. Test current lookup behavior
  console.log("\n═══════════════════════════════════════════");
  console.log("  LOOKUP TEST");
  console.log("═══════════════════════════════════════════\n");

  if (merchants && merchants.length > 0) {
    const testPhone = merchants[0].phone;
    const digits = testPhone.replace(/\D/g, "");
    const normalized = digits.startsWith("977") ? `+${digits}` : `+977${digits}`;
    const bare10 = digits.slice(-10);
    const with977 = `977${bare10}`;

    console.log(`Testing with first merchant phone: "${testPhone}"`);
    console.log(`  Normalized (+977...): "${normalized}"`);
    console.log(`  Bare 10-digit:       "${bare10}"`);
    console.log(`  977-prefixed:        "${with977}"`);

    // Test each format
    for (const [label, fmt] of [["Normalized", normalized], ["Bare 10-digit", bare10], ["977-prefixed", with977]]) {
      const { data, error } = await (admin.from("merchants") as any)
        .select("id, phone")
        .eq("phone", fmt)
        .maybeSingle();
      console.log(`  Query .eq("phone", "${fmt}") → ${label}: ${data ? `✅ FOUND (${data.phone})` : "❌ NOT FOUND"}`);
    }
  }

  console.log("\n✅ Diagnostic complete.");
}

main().catch(console.error);
