# Database Schema (Supabase / PostgreSQL)

## Entity Relationship & Schema Layout

### 1. table: merchants
- `id` (uuid, Primary Key)
- `name` (text)
- `phone` (text, unique)
- `business_type` (text) -- values: 'kirana' | 'dairy'
- `created_at` (timestamptz)

### 2. table: customers
- `id` (uuid, Primary Key)
- `name` (text, nullable)
- `phone` (text) -- Note: Same phone can exist across multiple independent merchants
- `home_location_gps` (geography(point), nullable)
- `created_at` (timestamptz)

### 3. table: merchant_customers (Junction Table)
- `id` (uuid, Primary Key)
- `merchant_id` (uuid, Foreign Key -> merchants.id ON DELETE CASCADE)
- `customer_id` (uuid, Foreign Key -> customers.id ON DELETE CASCADE)
- `credit_limit` (numeric, default 5000)
- `current_balance` (numeric, default 0) -- Read-optimized cached balance
- `UNIQUE(merchant_id, customer_id)`

### 4. table: credit_logs (The Financial Ledger)
- `id` (uuid, Primary Key)
- `merchant_id` (uuid, Foreign Key -> merchants.id)
- `customer_id` (uuid, Foreign Key -> customers.id)
- `amount` (numeric)
- `quantity` (numeric, nullable) -- used for unit metrics like liters/jars
- `unit` (text, nullable) -- values: 'liter' | 'jar' | 'kg' | 'piece'
- `description` (text, nullable)
- `type` (text) -- values: 'debit' (credit taken) | 'credit' (payment cleared)
- `status` (text) -- values: 'pending' | 'approved' | 'disputed'
- `sync_status` (text) -- values: 'online' | 'offline_pending'
- `ip_address` (text, nullable)
- `created_at` (timestamptz)