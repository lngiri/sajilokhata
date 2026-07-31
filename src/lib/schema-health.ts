export interface SchemaProbe {
  table: string;
  columns: string[];
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
