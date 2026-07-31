import { readFileSync, readdirSync } from "fs";
import { join } from "path";

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

async function main() {
  const n = process.argv[2];
  if (!n || !/^\d{3}$/.test(n)) {
    console.error("Usage: node --experimental-strip-types scripts/apply-migration.ts <NNN>");
    console.error("Example: node --experimental-strip-types scripts/apply-migration.ts 043");
    process.exit(2);
  }

  const vars = loadEnv();
  const supabaseUrl = vars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pat = vars.SUPABASE_PAT || process.env.SUPABASE_PAT;
  if (!supabaseUrl || !pat) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_PAT in .env / .env.local");
    process.exit(2);
  }

  const file = readdirSync("supabase/migrations").find((f) => f.startsWith(`${n}_`));
  if (!file) {
    console.error(`No migration found for ${n} in supabase/migrations/`);
    process.exit(2);
  }

  const sql = readFileSync(join("supabase/migrations", file), "utf-8");
  const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");

  console.log(`Project ref: ${projectRef}`);
  console.log(`Applying migration: ${file}`);
  console.log("---");

  const combinedSql = `${sql}\n\n-- Reload PostgREST schema cache so new tables/columns are visible immediately\nNOTIFY pgrst, 'reload schema';\n`;

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: combinedSql }),
      signal: AbortSignal.timeout(60_000),
    }
  );

  const text = await res.text();
  console.log(`HTTP Status: ${res.status}`);
  console.log(`Response: ${text.substring(0, 1000)}`);

  if (res.status >= 400) {
    console.error("\nFAILED");
    process.exit(1);
  }

  console.log(`\nSUCCESS - Migration ${n} applied.`);
}

main();
