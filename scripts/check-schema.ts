import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import {
  checkSchemaHealth,
  SCHEMA_MANIFEST,
  CHECK_CONSTRAINT_MANIFEST,
  diffCheckConstraints,
  fetchCheckConstraints,
} from "../src/lib/schema-health.ts";

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
  }

  if (result.missing.length > 0) {
    console.error("\nMISSING schema objects:");
    for (const item of result.missing) console.error(`  - ${item}`);
  }
  if (result.errors.length > 0) {
    console.error("\nProbe errors (possibly a connection problem):");
    for (const item of result.errors) console.error(`  - ${item}`);
  }
  if (result.missing.length > 0 || result.errors.length > 0) {
    console.error("\nFix: apply the missing migrations before deploying.");
    process.exit(1);
  }

  // CHECK constraints cannot be probed through PostgREST, so validate them via
  // the Supabase Management API when a PAT is available.
  const pat = vars.SUPABASE_PAT || process.env.SUPABASE_PAT;
  if (pat) {
    console.log(`Checking ${CHECK_CONSTRAINT_MANIFEST.length} CHECK constraints...`);
    try {
      const actual = await fetchCheckConstraints(url, pat);
      const problems = diffCheckConstraints(actual);
      if (problems.length > 0) {
        console.error("\nCHECK CONSTRAINT DRIFT:");
        for (const p of problems) console.error(`  - ${p}`);
        console.error("\nFix: apply the migration that updates the constraint before deploying.");
        process.exit(1);
      }
      console.log("OK - CHECK constraints match the app (no drift).");
    } catch (e: any) {
      console.warn(
        `Skipping CHECK constraint validation (could not reach Management API): ${e?.message || e}`
      );
    }
  } else {
    console.warn("SUPABASE_PAT not set - skipping CHECK constraint validation (columns only).");
  }
}

main();
