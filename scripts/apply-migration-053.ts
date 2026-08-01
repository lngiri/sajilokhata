import { readFileSync } from "fs";

function loadEnv(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const file of [".env.local", ".env"]) {
    try {
      const env = readFileSync(file, "utf-8");
      for (const line of env.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const i = t.indexOf("=");
        if (i > 0) vars[t.slice(0, i)] = t.slice(i + 1);
      }
    } catch {
      /* missing file, try next */
    }
  }
  return vars;
}

const vars = loadEnv();
const supabaseUrl = vars.NEXT_PUBLIC_SUPABASE_URL!;
const pat = vars.SUPABASE_PAT!;
const ref = new URL(supabaseUrl).hostname.split(".")[0];
const api = `https://api.supabase.com/v1/projects/${ref}/database/query`;

async function execSQL(sql: string): Promise<{ status: number; body: string }> {
  const res = await fetch(api, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

const constraintsSql = `
  SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conrelid = 'credit_logs'::regclass AND contype = 'c'
  ORDER BY conname;`;

async function main() {
  console.log("=== APPLYING SCHEMA MIGRATION 053 ===");
  console.log(`Target: ${supabaseUrl}\n`);

  console.log("--- Current CHECK constraints on credit_logs ---");
  const beforeRes = await execSQL(constraintsSql);
  console.log(`HTTP ${beforeRes.status}\n${beforeRes.body}\n`);
  if (beforeRes.status >= 400) {
    console.log("FAILED — could not read current constraints.");
    process.exit(1);
  }

  const statements = [
    {
      name: "1. Migrate existing pending/unverified rows (no-op if none)",
      sql: `
        UPDATE credit_logs SET status = 'awaiting_confirmation' WHERE status = 'unverified';
        UPDATE credit_logs SET status = 'awaiting_confirmation' WHERE status = 'pending';`,
    },
    {
      name: "2. Drop old status constraint",
      sql: `ALTER TABLE credit_logs DROP CONSTRAINT IF EXISTS credit_logs_status_check;`,
    },
    {
      name: "3. Add new status constraint",
      sql: `ALTER TABLE credit_logs ADD CONSTRAINT credit_logs_status_check
        CHECK (status IN ('awaiting_confirmation', 'approved', 'disputed', 'rejected', 'edit_requested'));`,
    },
  ];

  for (const stmt of statements) {
    console.log(`--- ${stmt.name} ---`);
    console.log(`SQL: ${stmt.sql.substring(0, 80)}...`);
    try {
      const result = await execSQL(stmt.sql);
      console.log(`Result: HTTP ${result.status}`);
      console.log(`Body: ${result.body.substring(0, 300)}`);
      if (result.status >= 400) {
        console.log("\nFAILED — stopping migration.");
        process.exit(1);
      }
      console.log("OK\n");
    } catch (e: any) {
      console.log(`ERROR: ${e.message}`);
      console.log("\nFAILED — stopping migration.");
      process.exit(1);
    }
  }

  console.log("--- CHECK constraints on credit_logs AFTER ---");
  const afterRes = await execSQL(constraintsSql);
  console.log(`HTTP ${afterRes.status}\n${afterRes.body}\n`);

  console.log("=== MIGRATION 053 APPLIED SUCCESSFULLY ===");
}

main();
