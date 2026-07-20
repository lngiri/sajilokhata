import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// Read .env
const env = readFileSync(".env", "utf-8");
const get = (k: string) => { const m = env.match(new RegExp(`^${k}=(.+)$`, "m")); return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : ""; };

const url = get("NEXT_PUBLIC_SUPABASE_URL");
const key = get("SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(url, key);

async function main() {
  console.log("=== CUSTOMER PHONE NUMBERS IN DB ===");
  
  const { data: customers, error: e1 } = await admin.from("customers").select("id, name, phone").limit(20);
  if (e1) console.error("Error:", e1);
  else customers?.forEach(c => console.log(`  ID: ${c.id}, Name: ${c.name}, Phone: "${c.phone}" (length: ${c.phone?.length})`));
  
  console.log("\n=== MERCHANT PHONE NUMBERS IN DB ===");
  const { data: merchants, error: e2 } = await admin.from("merchants").select("id, name, phone, sms_balance").limit(20);
  if (e2) console.error("Error:", e2);
  else merchants?.forEach(m => console.log(`  ID: ${m.id}, Name: ${m.name}, Phone: "${m.phone}" (length: ${m.phone?.length}), SMS Balance: ${m.sms_balance}`));
  
  console.log("\n=== PAYMENT REMINDER LOGS (last 10) ===");
  const { data: logs, error: e3 } = await admin.from("payment_reminder_logs").select("*, customers(name, phone)").order("sent_at", { ascending: false }).limit(10);
  if (e3) console.error("Error:", e3);
  else logs?.forEach(l => console.log(`  Status: ${l.status}, Error: ${l.error_message}, Customer: ${l.customers?.name}, Phone: "${l.customers?.phone}", Message: "${l.message?.substring(0, 80)}"`));
}
main();
