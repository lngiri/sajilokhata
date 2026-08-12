import { readFileSync } from "fs";

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

const SESSION_DURATION = 30 * 24 * 60 * 60;

async function hmacSign(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function main() {
  const vars = loadEnv();
  const secret = vars.SUPABASE_SERVICE_ROLE_KEY;
  const keyLen = secret ? secret.length : 0;
  console.log("secret from env:", secret ? `present (len ${keyLen})` : "MISSING");

  const userId = process.argv[2] || "5f0db844-9e60-46aa-93d6-e820019da1be";
  const now = Date.now();
  const payload = `${userId}.${now}.${now + SESSION_DURATION * 1000}`;
  const sig = await hmacSign(payload, secret!);
  const token = `${payload}.${sig}`;
  console.log("token:", token.slice(0, 60) + "...");

  for (const base of ["https://app.qrhisab.com", "https://sajilokhata-fhl0iag70-lngiris-projects.vercel.app"]) {
    console.log(`\n=== GET ${base}/merchant/dashboard (with cookie) ===`);
    try {
      const res = await fetch(`${base}/merchant/dashboard`, {
        headers: { Cookie: `session=${token}` },
        redirect: "manual",
      });
      console.log("status:", res.status);
      console.log("location:", res.headers.get("location"));
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("html")) {
        const body = await res.text();
        const m = body.match(/<title>(.*?)<\/title>/i);
        console.log("title:", m?.[1] || "(none)");
        console.log("body snippet:", body.replace(/\s+/g, " ").slice(0, 120));
      } else {
        console.log("content-type:", ct);
      }
    } catch (e: any) {
      console.log("error:", e.message);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
