export interface SchemaProbe {
  table: string;
  columns: string[];
}

export interface CheckConstraintProbe {
  table: string;
  constraint: string;
  column: string;
  expected: string[];
}

/**
 * CHECK constraints the app depends on. `expected` lists the values the app
 * writes today. If production's constraint no longer allows any of them, every
 * matching write fails with a DB error (e.g. the credit_logs_status_check drift
 * that rejected 'awaiting_confirmation'). Column probes can't catch this, so
 * the constraint definitions must be compared directly.
 */
export const CHECK_CONSTRAINT_MANIFEST: CheckConstraintProbe[] = [
  {
    table: "credit_logs",
    constraint: "credit_logs_status_check",
    column: "status",
    expected: ["awaiting_confirmation", "approved", "disputed", "rejected", "edit_requested"],
  },
  {
    table: "credit_logs",
    constraint: "credit_logs_type_check",
    column: "type",
    expected: ["debit", "credit", "cash", "expense", "cash_in"],
  },
  {
    table: "customers",
    constraint: "customers_registration_status_check",
    column: "registration_status",
    expected: ["invited", "registered"],
  },
  {
    table: "customer_invites",
    constraint: "customer_invites_status_check",
    column: "status",
    expected: [
      "pending",
      "sms_sent",
      "sms_failed",
      "invitation_opened",
      "otp_verified",
      "registration_completed",
      "expired",
      "cancelled",
    ],
  },
];

/** True if every value the app writes is allowed by the live constraint. */
export function diffCheckConstraints(
  actual: Record<string, string[]>,
  manifest: CheckConstraintProbe[] = CHECK_CONSTRAINT_MANIFEST
): string[] {
  const problems: string[] = [];
  for (const probe of manifest) {
    const allowed = actual[probe.constraint];
    if (!allowed) {
      problems.push(`CHECK constraint ${probe.constraint} missing on ${probe.table}`);
      continue;
    }
    const notAllowed = probe.expected.filter((v) => !allowed.includes(v));
    if (notAllowed.length > 0) {
      problems.push(
        `CHECK constraint ${probe.constraint} (${probe.table}.${probe.column}) does not allow the app's value(s): ${notAllowed.join(", ")}`
      );
    }
  }
  return problems;
}

/**
 * Reads live CHECK constraint definitions via the Supabase Management API
 * (requires a Project Access Token). Returns constraint-name → allowed values.
 */
export async function fetchCheckConstraints(
  supabaseUrl: string,
  pat: string
): Promise<Record<string, string[]>> {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  const tables = Array.from(new Set(CHECK_CONSTRAINT_MANIFEST.map((p) => p.table)));
  const list = tables.map((t) => `'${t}'`).join(", ");

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `SELECT c.conname AS name, pg_get_constraintdef(c.oid) AS def
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.contype = 'c' AND n.nspname = 'public' AND t.relname IN (${list})
        ORDER BY c.conname;`,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(
      `Supabase Management API returned HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`
    );
  }

  const rows = (await res.json()) as { name: string; def: string }[];
  const map: Record<string, string[]> = {};
  for (const row of rows) {
    const quoted = row.def.matchAll(/'([^']*)'/g);
    map[row.name] = Array.from(quoted, (m) => m[1]);
  }
  return map;
}

export const SCHEMA_MANIFEST: SchemaProbe[] = [
  { table: "merchants", columns: ["id", "name", "phone", "business_type"] },
  { table: "customers", columns: ["id", "name", "phone", "registration_status", "avatar_url"] },
  { table: "merchant_customers", columns: ["id", "merchant_id", "customer_id", "credit_limit"] },
  {
    table: "credit_logs",
    columns: [
      "id",
      "merchant_id",
      "customer_id",
      "amount",
      "type",
      "description",
      "status",
      "approved_at",
      "sync_status",
      "initiated_by",
      "attachment_url",
      "idempotency_key",
    ],
  },
  {
    table: "credit_log_items",
    columns: ["id", "credit_log_id", "product_id", "product_name", "quantity", "unit", "unit_price"],
  },
  { table: "notifications", columns: ["id", "user_id", "user_type", "type", "title", "body", "reference_id"] },
  { table: "audit_logs", columns: ["id", "inserted_at", "merchant_id", "actor_id", "actor_type", "action_type", "table_name", "record_id"] },
  { table: "sessions", columns: ["id", "merchant_id", "device_info", "ip_address", "last_active"] },
  { table: "merchant_products", columns: ["id", "merchant_id", "name", "default_rate", "is_active"] },
  { table: "merchant_payment_methods", columns: ["merchant_id"] },
  { table: "merchant_reminder_settings", columns: ["merchant_id"] },
  { table: "payment_reminder_logs", columns: ["merchant_id", "customer_id"] },
  { table: "sms_requests", columns: ["id", "merchant_id", "status"] },
  { table: "sms_recharge_logs", columns: ["merchant_id", "amount"] },
  { table: "short_links", columns: ["id", "code", "destination_url"] },
  { table: "merchant_ai_usage", columns: ["merchant_id"] },
  { table: "customer_invites", columns: ["customer_id", "status"] },
  { table: "rate_limits", columns: ["key", "expires_at"] },
  { table: "admins", columns: ["id", "email", "name"] },
  { table: "app_settings", columns: ["key", "value"] },
];

export interface SchemaHealthResult {
  ok: boolean;
  missing: string[];
  errors: string[];
}

/**
 * Probes a Supabase admin client for the schema objects the app depends on.
 * A missing column surfaces as PostgREST error 42703, a missing table as 42P01.
 */
export async function checkSchemaHealth(admin: any): Promise<SchemaHealthResult> {
  const missing: string[] = [];
  const errors: string[] = [];

  for (const probe of SCHEMA_MANIFEST) {
    const { error: tableError } = await admin.from(probe.table).select("*").limit(1);
    if (tableError) {
      if (tableError?.code === "42P01") {
        missing.push(probe.table);
      } else {
        errors.push(`${probe.table}: ${tableError?.message || String(tableError)}`);
      }
      continue;
    }

    for (const column of probe.columns) {
      const { error: columnError } = await admin.from(probe.table).select(column).limit(1);
      if (columnError && columnError?.code === "42703") {
        missing.push(`${probe.table}.${column}`);
      } else if (columnError) {
        errors.push(`${probe.table}.${column}: ${columnError?.message || String(columnError)}`);
      }
    }
  }

  return { ok: missing.length === 0 && errors.length === 0, missing, errors };
}
