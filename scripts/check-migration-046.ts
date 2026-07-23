import { createClient } from "@supabase/supabase-js";
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
const supabase = createClient(url, key);

async function check() {
  console.log("=== Checking migration 046 status ===\n");

  // Check if customer_invites table exists
  const { data: invites, error: e1 } = await supabase
    .from("customer_invites")
    .select("id")
    .limit(1);
  
  if (e1 && e1.code === "42P01") {
    console.log("❌ customer_invites table does NOT exist");
  } else if (e1) {
    console.log("⚠️  customer_invites error:", e1.message, e1.code);
  } else {
    console.log("✅ customer_invites table EXISTS");
  }

  // Check registration_status column
  const { data: custs, error: e2 } = await supabase
    .from("customers")
    .select("registration_status")
    .limit(1);
  
  if (e2 && (e2.code === "42703" || e2.message?.includes("registration_status"))) {
    console.log("❌ registration_status column does NOT exist on customers table");
  } else if (e2) {
    console.log("⚠️  customers error:", e2.message, e2.code);
  } else {
    console.log("✅ registration_status column EXISTS on customers table");
    if (custs && custs.length > 0) {
      console.log("   Sample value:", custs[0].registration_status);
    }
  }
}

check().catch(console.error);
