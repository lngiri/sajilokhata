# Database Schema

Supabase (PostgreSQL) with PostGIS extension. 47 migrations (001–046, 099). 18 tables + 1 materialized view.

---

## Tables

### 1. `merchants`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `name` | TEXT | NOT NULL | | |
| `phone` | TEXT | NOT NULL | | UNIQUE |
| `business_type` | TEXT | NOT NULL | | CHECK IN (`kirana`, `dairy`, `meat`, `hardware`, `clothing`, `pharmacy`, `restaurant`, `other`) |
| `business_name` | TEXT | nullable | NULL | |
| `address` | TEXT | NOT NULL | `''` | |
| `photo_url` | TEXT | nullable | NULL | |
| `pin_hash` | TEXT | nullable | NULL | bcrypt hash |
| `status` | TEXT | NOT NULL | `'active'` | CHECK IN (`active`, `suspended`) |
| `suspended_at` | TIMESTAMPTZ | nullable | NULL | |
| `force_logout_at` | TIMESTAMPTZ | nullable | NULL | for admin kill-switch |
| `sms_balance` | INTEGER | NOT NULL | `10` | |
| `payment_enabled` | BOOLEAN | NOT NULL | `true` | |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | |

**Indexes:** `merchants_phone_key` (UNIQUE), `idx_merchants_phone_lookup`, `idx_merchants_name_lookup`

### 2. `customers`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `name` | TEXT | nullable | NULL | |
| `phone` | TEXT | NOT NULL | | UNIQUE |
| `pin_hash` | TEXT | nullable | NULL | |
| `home_location_gps` | GEOGRAPHY(POINT,4326) | nullable | NULL | PostGIS |
| `trust_status` | TEXT | NOT NULL | `'good'` | CHECK IN (`good`, `warning`, `defaulter`) |
| `trust_notes` | TEXT | nullable | NULL | |
| `flagged_by_merchant_id` | UUID | nullable | NULL | FK → merchants(id) ON DELETE SET NULL |
| `flagged_at` | TIMESTAMPTZ | nullable | NULL | |
| `avatar_url` | TEXT | nullable | NULL | |
| `address` | TEXT | NOT NULL | `''` | |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | |

**Indexes:** `customers_phone_key` (UNIQUE), `idx_customers_phone`, `idx_customers_flagged_by`

### 3. `merchant_customers` (Junction)

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `merchant_id` | UUID | NOT NULL | | FK → merchants(id) ON DELETE CASCADE |
| `customer_id` | UUID | NOT NULL | | FK → customers(id) ON DELETE CASCADE |
| `credit_limit` | NUMERIC | NOT NULL | `5000` | CHECK ≥ 0 |
| `nickname` | TEXT | nullable | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | |

**Constraints:** UNIQUE(`merchant_id`, `customer_id`)
**Note:** `current_balance` was dropped in migration 003. Balance is computed dynamically from approved `credit_logs`.

### 4. `credit_logs` (Financial Ledger)

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `merchant_id` | UUID | NOT NULL | | FK → merchants(id) ON DELETE CASCADE |
| `customer_id` | UUID | nullable | NULL | FK → customers(id) ON DELETE CASCADE |
| `amount` | NUMERIC | NOT NULL | | CHECK > 0 |
| `quantity` | NUMERIC | nullable | NULL | |
| `unit` | TEXT | nullable | NULL | CHECK IN (`liter`, `jar`, `kg`, `piece`, `npr`) |
| `description` | TEXT | nullable | NULL | |
| `type` | TEXT | NOT NULL | | CHECK IN (`debit`, `credit`, `cash`) |
| `status` | TEXT | NOT NULL | `'pending'` | CHECK IN (`pending`, `unverified`, `approved`, `disputed`, `rejected`, `edit_requested`) |
| `sync_status` | TEXT | NOT NULL | `'online'` | CHECK IN (`online`, `offline_pending`) |
| `ip_address` | TEXT | nullable | NULL | |
| `device_info` | TEXT | nullable | NULL | |
| `verification_token` | UUID | nullable | `gen_random_uuid()` | |
| `disputed_reason` | TEXT | nullable | NULL | |
| `proposed_amount` | NUMERIC | nullable | NULL | |
| `attachment_url` | TEXT | nullable | NULL | |
| `initiated_by` | TEXT | NOT NULL | `'merchant'` | CHECK IN (`merchant`, `customer`) |
| `idempotency_key` | TEXT | nullable | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `approved_at` | TIMESTAMPTZ | nullable | NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | |

**Indexes:** 14 indexes covering merchant, customer, status, type, created_at, idempotency_key, and composite patterns.
**Realtime:** Added to `supabase_realtime` publication.

### 5. `sessions`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `merchant_id` | UUID | NOT NULL | | FK → merchants(id) ON DELETE CASCADE |
| `device_info` | TEXT | NOT NULL | | |
| `ip_address` | TEXT | NOT NULL | `''` | |
| `last_active` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | |

### 6. `audit_logs` (Rebuilt in migration 040)

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `inserted_at` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `merchant_id` | UUID | nullable | NULL | FK → merchants(id) ON DELETE CASCADE |
| `actor_id` | UUID | NOT NULL | | |
| `actor_type` | TEXT | NOT NULL | | CHECK IN (`merchant`, `customer`, `system`) |
| `action_type` | TEXT | NOT NULL | | free-form (e.g. `created`, `approved`, `disputed`, `rejected`, `edit_requested`, `edit_accepted`, `edit_rejected`, `modified`, `deleted`, `status_changed`) |
| `table_name` | TEXT | NOT NULL | | |
| `record_id` | UUID | NOT NULL | | |
| `old_data` | JSONB | nullable | NULL | |
| `new_data` | JSONB | nullable | NULL | |

**RLS:** SELECT for authenticated users on own `merchant_id`; ALL writes blocked for authenticated (INSERT only via `service_role`).

### 7. `admins`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `email` | TEXT | NOT NULL | | UNIQUE |
| `name` | TEXT | NOT NULL | `''` | |
| `password_hash` | TEXT | nullable | NULL | bcrypt |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | |

### 8. `app_settings`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `key` | TEXT | NOT NULL | | PRIMARY KEY |
| `value` | JSONB | NOT NULL | `'{}'` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | |

### 9. `merchant_payment_methods`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `merchant_id` | UUID | NOT NULL | | FK → merchants(id) ON DELETE CASCADE |
| `method_type` | TEXT | NOT NULL | | CHECK IN (`fonepay`, `esewa`, `khalti`, `nepalpay`, `bank_deposit`, `cash`) |
| `label` | TEXT | nullable | NULL | |
| `qr_url` | TEXT | nullable | NULL | |
| `account_holder` | TEXT | nullable | NULL | |
| `account_number` | TEXT | nullable | NULL | |
| `bank_name` | TEXT | nullable | NULL | |
| `is_active` | BOOLEAN | NOT NULL | `true` | |
| `sort_order` | INTEGER | NOT NULL | `0` | |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | |

**Constraints:** UNIQUE(`merchant_id`, `method_type`)

### 10. `merchant_reminder_settings`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `merchant_id` | UUID | NOT NULL | | FK → merchants(id) ON DELETE CASCADE |
| `auto_reminder_enabled` | BOOLEAN | NOT NULL | `false` | |
| `reminder_message_template` | TEXT | nullable | `'Dear {customer}, pay Rs. {balance} to {shop}.'` | |
| `reminder_day_of_month` | INTEGER | NOT NULL | `1` | CHECK BETWEEN 1 AND 28 |
| `last_reminder_at` | TIMESTAMPTZ | nullable | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | |

**Constraints:** UNIQUE(`merchant_id`)

### 11. `payment_reminder_logs`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `merchant_id` | UUID | NOT NULL | | FK → merchants(id) ON DELETE CASCADE |
| `customer_id` | UUID | NOT NULL | | FK → customers(id) ON DELETE CASCADE |
| `credit_log_id` | UUID | nullable | NULL | FK → credit_logs(id) ON DELETE SET NULL |
| `type` | TEXT | NOT NULL | | CHECK IN (`sms`, `share_link`) |
| `message` | TEXT | NOT NULL | | |
| `sent_at` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `status` | TEXT | NOT NULL | `'sent'` | CHECK IN (`sent`, `failed`) |
| `error_message` | TEXT | nullable | NULL | |

### 12. `sms_recharge_logs`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `merchant_id` | UUID | NOT NULL | | FK → merchants(id) ON DELETE CASCADE |
| `amount` | NUMERIC(10,2) | NOT NULL | | |
| `sms_count` | INTEGER | NOT NULL | | |
| `transaction_uuid` | TEXT | NOT NULL | | UNIQUE |
| `status` | TEXT | NOT NULL | `'pending'` | CHECK IN (`pending`, `completed`, `failed`) |
| `esewa_ref_id` | TEXT | nullable | NULL | UNIQUE |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | |

### 13. `sms_requests`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `merchant_id` | UUID | NOT NULL | | FK → merchants(id) ON DELETE CASCADE |
| `amount` | NUMERIC(10,2) | NOT NULL | | |
| `sms_count` | INTEGER | NOT NULL | | |
| `transaction_id` | TEXT | nullable | NULL | |
| `screenshot_url` | TEXT | nullable | NULL | |
| `status` | TEXT | NOT NULL | `'pending'` | CHECK IN (`pending`, `approved`, `rejected`) |
| `idempotency_key` | TEXT | nullable | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | |

**Note:** Not in TypeScript types file (`database.ts`).

### 14. `short_links`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `code` | VARCHAR(10) | NOT NULL | | UNIQUE |
| `destination_url` | TEXT | NOT NULL | | |
| `created_at` | TIMESTAMPTZ | nullable | `NOW()` | |

### 15. `merchant_ai_usage`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `merchant_id` | UUID | NOT NULL | | FK → merchants(id) ON DELETE CASCADE |
| `model_name` | TEXT | NOT NULL | `'gemini-2.5-flash'` | |
| `input_tokens` | INTEGER | NOT NULL | `0` | |
| `output_tokens` | INTEGER | NOT NULL | `0` | |
| `parse_count` | INTEGER | NOT NULL | `1` | |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | |

**Unique index:** `idx_merchant_ai_usage_daily` on (`merchant_id`, `model_name`, `created_at::date`)

### 16. `rate_limits`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `key` | TEXT | NOT NULL | | PRIMARY KEY |
| `count` | INTEGER | NOT NULL | `0` | |
| `expires_at` | TIMESTAMPTZ | NOT NULL | `now()` | |

**Note:** Not in TypeScript types file (`database.ts`). Service-role only access.

### 17. `merchant_products`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `merchant_id` | UUID | NOT NULL | | FK → merchants(id) ON DELETE CASCADE |
| `name` | TEXT | NOT NULL | | |
| `unit` | TEXT | NOT NULL | `'piece'` | |
| `default_rate` | NUMERIC | NOT NULL | | CHECK ≥ 0 |
| `category` | TEXT | nullable | NULL | |
| `is_active` | BOOLEAN | NOT NULL | `true` | |
| `sort_order` | INT | NOT NULL | `0` | |
| `metadata` | JSONB | nullable | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | |

**Indexes:** `idx_merchant_products_merchant`, `idx_merchant_products_active` (partial WHERE is_active = true)
**RLS:** Merchants manage own products (auth.uid() = merchant_id)
**Trigger:** `trg_merchant_products_updated_at` — updates `updated_at` on row change

### 18. `credit_log_items`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `credit_log_id` | UUID | NOT NULL | | FK → credit_logs(id) ON DELETE CASCADE |
| `product_id` | UUID | nullable | NULL | FK → merchant_products(id) ON DELETE SET NULL |
| `product_name` | TEXT | NOT NULL | | |
| `quantity` | NUMERIC | NOT NULL | | CHECK > 0 |
| `unit` | TEXT | NOT NULL | `'piece'` | |
| `unit_price` | NUMERIC | NOT NULL | | CHECK ≥ 0 |
| `line_total` | NUMERIC | NOT NULL | | GENERATED ALWAYS AS (quantity * unit_price) STORED |
| `description` | TEXT | nullable | NULL | |
| `sort_order` | INT | NOT NULL | `0` | |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | |

**Indexes:** `idx_credit_log_items_log`, `idx_credit_log_items_product` (partial WHERE product_id IS NOT NULL)
**RLS:** Users see items for accessible logs; Merchants insert items for own logs

---

## Materialized View: `customer_summary`

| Column | Type |
|--------|------|
| `merchant_id` | UUID |
| `customer_id` | UUID |
| `customer_name` | TEXT |
| `customer_phone` | TEXT |
| `credit_limit` | NUMERIC |
| `current_balance` | NUMERIC |
| `pending_entries` | BIGINT |
| `total_debit_entries` | BIGINT |
| `total_credit_entries` | BIGINT |
| `total_debit_amount` | NUMERIC |
| `total_credit_amount` | NUMERIC |
| `last_transaction_at` | TIMESTAMPTZ |

`current_balance` is computed dynamically: approved debits minus approved credits. Unique index on (`merchant_id`, `customer_id`).

---

## Shared userId Architecture

Dual-role users (both merchant and customer) share the **same UUID** across both `merchants` and `customers` tables. When `registerNewUser()` detects that the phone already exists in the other table, it reuses the existing `id` for the new role row. This enables the session API to look up roles by a single userId.

The `check_cross_table_role_conflict` trigger (migration 008) was dropped in migration 010, allowing the same phone in both tables.

---

## Stored Functions

| Function | Security | Purpose |
|----------|----------|---------|
| `check_credit_limit()` | Trigger fn | BEFORE INSERT/UPDATE on credit_logs when status=approved. Raises exception if debit exceeds credit limit. |
| `process_audit_log()` | SECURITY DEFINER | AFTER INSERT/UPDATE/DELETE on credit_logs. Auto-creates audit_logs entries with smart action_type detection. |
| `decrement_sms_balance(UUID)` | SECURITY DEFINER | Decrements `sms_balance` by 1, floors at 0. |
| `increment_sms_balance(UUID, INTEGER)` | SECURITY DEFINER | Adds amount to `sms_balance`. |
| `decrement_sms_balance_bulk(UUID, INTEGER)` | SECURITY DEFINER | Bulk decrement by amount, floors at 0. |
| `get_customer_balance(UUID, UUID)` | SECURITY DEFINER | Returns approved balance (debit - credit) plus pending opening balances. Excludes `cash` type. |
| `import_customers(JSONB)` | SECURITY DEFINER | Bulk import: upserts customers, junction records, credit_logs, and optional short_links. |
| `get_user_directory_safe()` | SQL fn | Unions merchants + customers, detects dual-role by phone overlap. |

---

## Active Triggers

| Trigger | Table | Timing | Function |
|---------|-------|--------|----------|
| `trg_check_credit_limit` | credit_logs | BEFORE INSERT/UPDATE OF status (WHEN status='approved') | `check_credit_limit()` |
| `audit_credit_logs_trigger` | credit_logs | AFTER INSERT/UPDATE/DELETE | `process_audit_log()` |
| `trg_sms_requests_updated_at` | sms_requests | BEFORE UPDATE | `update_sms_requests_updated_at()` |

**Dropped triggers:** `trg_update_balance` (003), `before_merchant_insert_update` (010), `before_customer_insert_update` (010).

---

## Storage Buckets

| Bucket | Public | MIME Types | Size Limit |
|--------|--------|------------|------------|
| `app_assets` | true | png, jpeg, webp, gif | 5 MB |
| `transaction_attachments` | true | png, jpeg, webp, gif | 5 MB |
| `payment-proofs` | false | png, jpeg, webp, gif, jpg | 5 MB |

---

## TypeScript Type Discrepancies

The following exist in the database but are missing from `src/lib/types/database.ts`:

| Missing | Added In |
|---------|----------|
| `merchants.payment_enabled` column | Migration 034 |
| `sms_requests` table (all columns) | Migration 036 |
| `rate_limits` table (all columns) | Migration 042 |
| `credit_logs.idempotency_key` column | Migration 043 |
| `sms_requests.idempotency_key` column | Migration 043 |
