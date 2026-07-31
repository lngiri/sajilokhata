import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { checkSchemaHealth } from "@/lib/schema-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const expectedToken = process.env.HEALTH_TOKEN;
  const provided =
    new URL(request.url).searchParams.get("token") ??
    request.headers.get("x-health-token");

  if (expectedToken && provided !== expectedToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!hasUrl || !hasKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase env vars missing", env: { url: hasUrl, serviceRoleKey: hasKey } },
      { status: 500 }
    );
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Admin client unavailable" },
      { status: 500 }
    );
  }

  try {
    const result = await checkSchemaHealth(admin);
    return NextResponse.json(
      {
        ok: result.ok,
        missing: result.missing,
        errors: result.errors,
        checkedAt: new Date().toISOString(),
      },
      { status: result.ok ? 200 : 500 }
    );
  } catch (err) {
    console.error("[Health] check failed:", err);
    return NextResponse.json(
      { ok: false, error: "Health check failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
