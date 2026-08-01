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

async function main() {
  console.log("=== BACKFILL: invited → registered (customers with customer-initiated logs) ===");
  console.log(`Target: ${supabaseUrl}\n`);

  const previewSql = `
    SELECT c.id, c.name, c.phone, c.registration_status,
           COUNT(cl.id) FILTER (WHERE cl.initiated_by = 'customer') AS customer_initiated_logs
    FROM customers c
    LEFT JOIN credit_logs cl ON cl.customer_id = c.id
    WHERE c.registration_status = 'invited'
    GROUP BY c.id, c.name, c.phone, c.registration_status
    ORDER BY c.created_at;`;

  console.log("--- Current 'invited' customers ---");
  const previewRes = await execSQL(previewSql);
  if (previewRes.status >= 400) {
    console.log(`FAILED — ${previewRes.body}`);
    process.exit(1);
  }
  const preview = JSON.parse(previewRes.body);
  console.log(JSON.stringify(preview, null, 2));

  const toFlip = (preview as any[]).filter((c) => (Number(c.customer_initiated_logs) || 0) > 0);
  if (toFlip.length === 0) {
    console.log("\nNo customers to flip. Done.");
    return;
  }

  console.log(`\n--- Flipping ${toFlip.length} customer(s) to 'registered' ---`);
  const updateSql = `
    UPDATE customers
    SET registration_status = 'registered'
    WHERE registration_status = 'invited'
      AND EXISTS (
        SELECT 1 FROM credit_logs cl
        WHERE cl.customer_id = customers.id AND cl.initiated_by = 'customer'
      );`;

  const updateRes = await execSQL(updateSql);
  console.log(`Result: HTTP ${updateRes.status}`);
  console.log(`Body: ${updateRes.body}`);
  if (updateRes.status >= 400) {
    console.log("\nFAILED — backfill aborted.");
    process.exit(1);
  }

  console.log("\n--- 'invited' customers AFTER ---");
  const afterRes = await execSQL(previewSql);
  if (afterRes.status < 400) {
    const after = JSON.parse(afterRes.body);
    console.log(JSON.stringify(after, null, 2));
  }

  console.log("\n=== BACKFILL COMPLETE ===");
}

main();
