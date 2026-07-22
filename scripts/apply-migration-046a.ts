import { readFileSync } from "fs";

const env = readFileSync(".env", "utf-8");
const vars: Record<string, string> = {};
for (const line of env.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) vars[t.slice(0, i)] = t.slice(i + 1);
}

const url = vars.NEXT_PUBLIC_SUPABASE_URL!;
const key = vars.SUPABASE_SERVICE_ROLE_KEY!;

async function execSQL(sql: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`${url}/sql/v1/`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

const statements = [
  {
    name: "1. Add registration_status column",
    sql: `ALTER TABLE customers ADD COLUMN IF NOT EXISTS registration_status TEXT NOT NULL DEFAULT 'invited' CHECK (registration_status IN ('invited', 'registered'));`,
  },
  {
    name: "2. Create index on registration_status",
    sql: `CREATE INDEX IF NOT EXISTS idx_customers_registration_status ON customers(registration_status);`,
  },
  {
    name: "3. Create customer_invites table",
    sql: `CREATE TABLE IF NOT EXISTS customer_invites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      phone TEXT NOT NULL,
      otp TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
      used_at TIMESTAMPTZ DEFAULT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
  },
  {
    name: "4. Create partial index on customer_invites",
    sql: `CREATE INDEX IF NOT EXISTS idx_customer_invites_phone ON customer_invites(phone, used_at) WHERE used_at IS NULL;`,
  },
  {
    name: "5. Enable RLS on customer_invites",
    sql: `ALTER TABLE customer_invites ENABLE ROW LEVEL SECURITY;`,
  },
  {
    name: "6. Create RLS policy on customer_invites",
    sql: `CREATE POLICY "Service role only" ON customer_invites FOR ALL USING (false) WITH CHECK (false);`,
  },
];

async function main() {
  console.log("=== APPLYING SCHEMA MIGRATION 046a ===");
  console.log(`Target: ${url}\n`);

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

  console.log("=== ALL 6 STATEMENTS APPLIED SUCCESSFULLY ===");
}

main();
