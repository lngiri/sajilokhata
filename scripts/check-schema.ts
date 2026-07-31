import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { checkSchemaHealth, SCHEMA_MANIFEST } from "../src/lib/schema-health.ts";

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
  const vars = loadEnv();
  const url = vars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = vars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env / .env.local"
    );
    process.exit(2);
  }

  console.log(`Probing ${url.replace("https://", "").replace(".supabase.co", "")}...`);
  console.log(`Checking ${SCHEMA_MANIFEST.length} tables / ${SCHEMA_MANIFEST.reduce((n, p) => n + p.columns.length, 0)} columns...`);

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await checkSchemaHealth(admin as any);

  if (result.missing.length === 0 && result.errors.length === 0) {
    console.log("\nOK - schema matches the app (no drift).");
    process.exit(0);
  }

  if (result.missing.length > 0) {
    console.error("\nMISSING schema objects:");
    for (const item of result.missing) console.error(`  - ${item}`);
  }
  if (result.errors.length > 0) {
    console.error("\nProbe errors (possibly a connection problem):");
    for (const item of result.errors) console.error(`  - ${item}`);
  }
  console.error("\nFix: apply the missing migrations before deploying.");
  process.exit(1);
}

main();
