import { readFileSync } from "fs";

// Read from both .env and .env.local
function loadEnv(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const file of [".env", ".env.local"]) {
    try {
      const content = readFileSync(file, "utf-8");
      for (const line of content.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const i = t.indexOf("=");
        if (i > 0) vars[t.slice(0, i)] = t.slice(i + 1);
      }
    } catch { /* file not found */ }
  }
  return vars;
}

const vars = loadEnv();
const supabaseUrl = vars.NEXT_PUBLIC_SUPABASE_URL!;
const pat = vars.SUPABASE_PAT!;
const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");

console.log(`Project ref: ${projectRef}`);
console.log(`PAT present: ${!!pat}`);

const sql = readFileSync("supabase/migrations/046a_customer_registration_schema.sql", "utf-8");

async function main() {
  console.log("\n=== APPLYING SCHEMA MIGRATION 046a VIA MANAGEMENT API ===\n");

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
      signal: AbortSignal.timeout(60_000),
    }
  );

  const text = await res.text();
  console.log(`HTTP Status: ${res.status}`);
  console.log(`Response: ${text.substring(0, 1000)}`);

  if (res.status >= 400) {
    console.log("\nFAILED");
    process.exit(1);
  }

  console.log("\nSUCCESS — Migration 046a applied.");
}

main();
