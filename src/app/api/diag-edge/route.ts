import { cookies } from "next/headers";
import { verifySessionToken, createSessionToken, SESSION_COOKIE } from "@/lib/session";

export const runtime = "edge";

export async function GET() {
  const lines: string[] = [];
  const add = (s: string) => lines.push(s);

  add("=== /api/diag-edge (EDGE runtime) ===");
  add("now: " + new Date().toISOString());
  add("env SESSION_HMAC_SECRET: " + (process.env.SESSION_HMAC_SECRET ? "SET" : "unset"));
  add("env SUPABASE_SERVICE_ROLE_KEY: " + (process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET(len=" + (process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0) + ")" : "unset"));
  add("env NEXT_PUBLIC_SUPABASE_URL: " + (process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "unset"));
  add("env NEXT_PUBLIC_SUPABASE_ANON_KEY: " + (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "unset"));
  add("env COOKIE_DOMAIN: " + (process.env.COOKIE_DOMAIN ? "SET=" + process.env.COOKIE_DOMAIN : "unset"));
  add("env NODE_ENV: " + (process.env.NODE_ENV ?? "unset"));

  const cs = await cookies();
  const raw = cs.get(SESSION_COOKIE)?.value;
  add("session cookie present: " + !!raw);
  let userId: string | null = null;
  if (raw) {
    add("cookie parts: " + raw.split(".").length + " | prefix: " + raw.slice(0, 20));
    try {
      const v = await verifySessionToken(raw);
      userId = v?.userId ?? null;
      add("verifySessionToken(cookie): " + (v ? "VALID userId=" + v.userId + " iat=" + v.iat : "INVALID/EXPIRED"));
    } catch (e: any) {
      add("verify threw: " + (e?.message ?? String(e)));
    }
  }

  try {
    const t = await createSessionToken("diag-self");
    const v = await verifySessionToken(t.token);
    add("edge self-sign->verify: " + (v ? "OK" : "FAILED"));
  } catch (e: any) {
    add("edge self-sign threw: " + (e?.message ?? String(e)));
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      await (admin.from("diag_logs") as any).insert({ runtime: "edge", report: lines.join("\n") });
      add("DB self-report: INSERTED");
    } catch (e: any) {
      add("DB self-report FAILED: " + (e?.message ?? String(e)));
    }
  } else {
    add("DB self-report skipped: key/url missing on edge");
  }

  if (raw && userId) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url && key) {
        const admin = createClient(url, key, { auth: { persistSession: false } });
        const [m, c] = await Promise.all([
          (admin.from("merchants") as any).select("id,force_logout_at").eq("id", userId).maybeSingle(),
          (admin.from("customers") as any).select("id").eq("id", userId).maybeSingle(),
        ]);
        add("merchant row: " + (m?.data?.id ? "YES" : "no") + (m?.error ? " err=" + m.error.message : ""));
        add("customer row: " + (c?.data?.id ? "YES" : "no") + (c?.error ? " err=" + c.error.message : ""));
        add("force_logout_at: " + (m?.data?.force_logout_at ?? "none"));
        add("=> middleware would " + ((!userId || (!m?.data?.id && !c?.data?.id)) ? "REDIRECT to /login" : "ALLOW") + " (simulated)");
      } else {
        add("role lookup skipped: url/key missing on edge");
      }
    } catch (e: any) {
      add("role lookup threw: " + (e?.message ?? String(e)));
    }
  } else {
    add("=> middleware would REDIRECT to /login: NO_VALID_USER (no cookie or invalid)");
  }

  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain" } });
}
