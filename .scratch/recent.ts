import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const file of ["D:/vscode/SajiloKhata/.env", "D:/vscode/SajiloKhata/.env.local"]) {
    try {
      const content = readFileSync(file, "utf-8");
      for (const line of content.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const i = t.indexOf("=");
        if (i > 0) vars[t.slice(0, i)] = t.slice(i + 1);
      }
    } catch {}
  }
  return vars;
}

async function main() {
  const vars = loadEnv();
  const admin = createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  console.log(`=== machine now (UTC): ${new Date().toISOString()} ===`);

  const m = await (admin.from("merchants") as any).select("id,name,phone,created_at,pin_hash,force_logout_at").order("created_at", { ascending: false }).limit(8);
  console.log("=== merchants (recent) ===");
  for (const row of (m.data || [])) console.log(`  ${row.created_at} | ${row.phone} | pin:${row.pin_hash ? "SET" : "null"} | forceLogout:${row.force_logout_at ?? "none"} | ${row.name} | ${row.id}`);

  const s = await (admin.from("sessions") as any).select("merchant_id,last_active,created_at").order("created_at", { ascending: false }).limit(8);
  console.log("=== sessions (recent) ===");
  for (const row of (s.data || [])) console.log(`  created:${row.created_at} | last_active:${row.last_active} | merchant:${row.merchant_id}`);

  const mids = [...new Set((s.data || []).map((r: any) => r.merchant_id))];
  if (mids.length) {
    const who = await (admin.from("merchants") as any).select("id,name,phone,created_at,pin_hash").in("id", mids);
    console.log("=== session owners ===");
    for (const row of (who.data || [])) console.log(`  ${row.id} | ${row.name} | ${row.phone} | created:${row.created_at} | pin:${row.pin_hash ? "SET" : "null"}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
