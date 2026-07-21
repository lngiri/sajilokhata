# Business Logic, Limits, and Edge Cases

## 1. Registration Flow

New users register via phone OTP verification:
1. Enter phone number → `checkUserExists()` verifies no existing account
2. OTP sent via SMS → user enters code → `verifyRegistrationOtp()` validates
3. User selects role (Merchant or Customer)
4. `registerNewUser(phone, role)` creates the user row, sets session cookie, records session
5. User sets a 4-digit PIN (or skips — PIN can be set later from profile)

**Duplicate prevention:** `registerNewUser()` checks both `merchants` and `customers` tables. If the phone already exists with the target role, registration is blocked with a user-facing error.

## 2. Add-Role Flow

Existing single-role users can register for the second role:
1. `OtherRolePrompt` component (on dashboard) detects single-role status
2. User taps "Register as Customer" / "Register as Shop Owner"
3. Redirected to `/login?addRole=<targetRole>`
4. Login page detects the parameter, pre-fills phone, sends OTP
5. After OTP verification, `registerNewUser(phone, targetRole)` reuses the existing UUID (shared userId architecture)
6. User sets a PIN for the new role

**Guard:** If the user already has the target role, the add-role flow shows an error and stops.

## 3. Dual-Role Architecture

A single user can be both merchant and customer (same phone, same UUID in both tables):
- **Session API** returns `roles[]` array by querying both tables by userId
- **Role selection page** (`/select-role`) lets dual-role users pick their view
- **RoleSwitcher component** toggles between views without re-authentication
- **Post sign-out** offers quick re-login for the preferred role
- **Middleware** checks both tables when determining role-based access

## 4. Duplicate Phone Detection

- `merchants.phone` has a UNIQUE constraint
- `customers.phone` has a UNIQUE constraint
- Cross-table phone uniqueness is NOT enforced at the database level (migration 010 dropped the trigger)
- Same phone CAN exist in both `merchants` AND `customers` tables (intentional for dual-role users)
- `checkUserExists(phone)` queries both tables and merges results when the same userId appears in both

## 5. Role-Based Access Control

- **Merchant routes** (`/merchant/*`): Require valid session + merchant role in DB
- **Customer routes** (`/customer/*`): Require valid `customer_session` cookie
- **Admin routes** (`/admin/*`): Require separate `admin_session` cookie (isolated system)
- **Public routes** (`/`, `/login`, `/scan`, `/onboard`, `/verify`): No auth required
- **Middleware** redirects unauthorized users to appropriate login or dashboard based on their roles

## 6. Dispute Resolution Pipeline

- If a discrepancy arises between a merchant and a customer, either party can flag a transaction as `Disputed`.
- Disputed entries are excluded from active credit balances and held in a `Pending` state until both parties review, modify, and mutually re-approve the log.

## 7. Risk Mitigation & Credit Caps

- Merchants can assign an explicit `Credit Limit` (e.g., NPR 5,000) to each customer.
- The system automatically locks the customer's ability to log new credit entries once this limit is breached, forcing a settlement before further credit extensions.

## 8. Product Master

When a merchant has active products in their catalog, the entry form shows a product picker above the amount field. Selecting a product auto-fills the description, amount (rate), quantity, and unit. The merchant can override any field. Products are business-type agnostic — a dairy tracks liters, a kirana tracks pieces, a water delivery tracks jars.

Products are managed at `/merchant/products` (accessed via dashboard quick action card). Offline: products are cached in IndexedDB for reference; items are stored nested with the credit log and synced as a unit.

## 9. Partial Payment Settlements

- The architecture treats settlements dynamically. If a total debt is NPR 7,350 and the customer pays NPR 5,000, the ledger treats the incoming cash as a credit entry (`type: credit`).
- The system computes the current balance recursively to update the active outstanding due.

## 10. Account Migration & Recovery

- If a user loses their SIM card or changes numbers, a secure administrative dashboard allows the platform admin to map historical UUID profiles to the new verified MSISDN without losing ledger data.
