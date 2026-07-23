import { readFileSync } from "fs";

// Load env
const env = readFileSync(".env", "utf-8");
const envVars: Record<string, string> = {};
for (const line of env.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx > 0) {
    envVars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }
}

const url = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Read the migration SQL
const sql = readFileSync("supabase/migrations/046_customer_registration_flow.sql", "utf-8");

// Split into individual statements (skip comments and empty lines)
const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

console.log(`Found ${statements.length} SQL statements to execute`);

async function runMigration() {
  let success = 0;
  let errors = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ";";
    const preview = stmt.slice(0, 80).replace(/\n/g, " ");
    console.log(`\n[${i + 1}/${statements.length}] ${preview}...`);

    try {
      const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ query: stmt }),
      });

      const body = await res.text();

      if (res.ok) {
        console.log(`  ✅ OK (${res.status})`);
        success++;
      } else {
        // If exec_sql doesn't exist, try direct SQL endpoint
        console.log(`  ⚠️  exec_sql returned ${res.status}: ${body.slice(0, 200)}`);

        // Try the SQL API endpoint
        const res2 = await fetch(`${url}/sql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ query: stmt }),
        });

        const body2 = await res2.text();
        if (res2.ok) {
          console.log(`  ✅ OK via /sql endpoint (${res2.status})`);
          success++;
        } else {
          console.log(`  ❌ FAILED via /sql: ${res2.status} — ${body2.slice(0, 200)}`);
          errors++;
        }
      }
    } catch (err: any) {
      console.log(`  ❌ ERROR: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Migration complete: ${success} succeeded, ${errors} failed`);

  if (errors > 0) {
    console.log("\n⚠️  Some statements failed. Check if they already exist (IF NOT EXISTS).");
  }
}

runMigration().catch(console.error);
