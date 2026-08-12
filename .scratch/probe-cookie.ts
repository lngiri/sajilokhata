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

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function main() {
  const vars = loadEnv();
  const admin = createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // grab an existing merchant id
  const { data } = await (admin.from("merchants") as any).select("id").limit(1);
  const userId = data?.[0]?.id;
  console.log("Using merchant:", userId);

  const secret = vars.SESSION_HMAC_SECRET || vars.SUPABASE_SERVICE_ROLE_KEY;
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 30 * 24 * 3600 * 1000;
  const payload = `${userId}.${issuedAt}.${expiresAt}`;
  const sig = await sign(payload, secret);
  const token = `${payload}.${sig}`;
  console.log("token prefix:", token.slice(0, 30));

  for (const url of ["https://sajilokhata-fhl0iag70-lngiris-projects.vercel.app/merchant/dashboard"]) {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { Cookie: `session=${token}` },
    });
    console.log(url);
    console.log("  status:", res.status);
    console.log("  location:", res.headers.get("location"));
    const body = await res.text();
    if (res.status === 200) {
      console.log("  200 OK — page rendered, middleware accepted session");
    } else {
      console.log("  body snippet:", body.slice(0, 120).replace(/\s+/g, " "));
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
