# SajiloKhata (QR Hisab) — Architecture

**Stack:** Next.js 16 (App Router + Turbopack) · React 19 · Supabase (Postgres + Auth) · Tailwind CSS 4 · TypeScript 6 · PWA  
**Runtime:** Node.js server actions + Edge Middleware (middleware.ts)  
**Test:** Vitest + Testing Library  
**Deploy:** Vercel  

---

## Directory Layout

```
src/
├── app/                          # Next.js App Router pages
│   ├── actions/                  # Server Actions (otp, pin, merchant, admin, sms-billing, etc.)
│   ├── admin/                    # Admin panel (dashboard, users, analytics, etc.)
│   ├── api/                      # API route handlers (auth, merchant, sms, verify, billing, ai)
│   │   └── merchant/
│   │       └── billing/
│   │           └── callback/     # eSewa POST callback handler
│   ├── business/[merchantId]/    # Public merchant landing page
│   ├── customer/                 # Customer-facing pages (dashboard, history, settings)
│   ├── login/                    # Auth wizard (phone → OTP → PIN → dashboard)
│   ├── merchant/                 # Merchant pages (dashboard, logs, customers, qr, billing, settings, scan, reports, cash-sales, import, products)
│   │   ├── billing/              # SMS credit recharge
│   │   ├── products/             # Product Master management (add/edit/delete products)
│   │   │   └── success/          # Payment confirmation / failure UI
│   ├── onboard/                  # Customer onboarding (OTP with resend + cooldown)
│   ├── scan/                     # QR scanner for customer entry
│   ├── select-role/              # Dual-role user picks merchant or customer
│   ├── verify/                   # Verification dispute/resolution page
│   ├── layout.tsx                # Root layout (toast, SW registrar, meta)
│   ├── globals.css               # Tailwind + custom CSS variables
│   ├── error.tsx                 # Global error boundary
│   ├── loading.tsx               # Global loading spinner
│   └── not-found.tsx             # 404 page
│
├── components/                   # Shared UI components (30 files)
│   ├── ActionHub.tsx             # Floating action hub (support, refer, feedback)
│   ├── AdminGuard.tsx            # Admin route guard (client-side)
│   ├── AuthProvider.tsx          # React context for auth state
│   ├── BottomNav.tsx             # Merchant 5-tab navigation
│   ├── CustomerBottomNav.tsx     # Customer tab navigation
│   ├── CustomerOnboardingModal.tsx
│   ├── CustomerPinGate.tsx       # PIN gate for customer flows
│   ├── DescriptionSuggestions.tsx # AI-powered description suggestions
│   ├── AmountSuggestions.tsx     # AI-powered amount suggestions
│   ├── FeedbackModal.tsx         # Feedback form (Formspree)
│   ├── MerchantOnboardingModal.tsx
│   ├── NetworkStatus.tsx         # Online/offline banner
│   ├── OfflineIndicator.tsx      # Pending sync count badge
│   ├── OtherRolePrompt.tsx       # Prompt to register second role
│   ├── PendingApprovalModal.tsx  # Approve/reject credit edits
│   ├── PullToRefresh.tsx         # Pull-to-refresh wrapper
│   ├── PWAInstallBanner.tsx      # "Install app" prompt
│   ├── QRCode.tsx                # QR display + scanner components
│   ├── QuickAddCustomer.tsx      # Quick customer creation
│   ├── ReferModal.tsx            # "Refer a friend" share modal
│   ├── RoleSwitcher.tsx          # Role toggle for dual-role users
│   ├── ServiceWorkerRegistrar.tsx # SW registration + cache-bust on version bump
│   ├── SessionGuard.tsx          # Client-side session check + redirect
│   ├── SessionHeartbeat.tsx      # Periodic session cookie refresh
│   ├── SmsReminderModal.tsx      # SMS payment reminder
│   ├── SyncStatus.tsx            # Offline sync indicator
│   ├── ThemeSwitcher.tsx         # Dark/light theme toggle
│   ├── Toast.tsx                 # Toast notification system
│   ├── TransactionIcon.tsx       # Transaction type icon
│   └── VersionGuard.tsx          # App version mismatch detection
│
├── lib/                          # Shared logic
│   ├── actions.ts                # Legacy server actions (credit logs, customers, etc.)
│   ├── auth.ts                   # Client-side auth helpers (getCurrentMerchantId, signOut)
│   ├── session.ts                # HMAC-SHA256 session token creation/verification
│   ├── admin-session.ts          # Admin session token (separate HMAC key)
│   ├── phone.ts                  # Phone number normalization (Nepal +977)
│   ├── rate-limit.ts             # In-memory rate limiter
│   ├── sms.ts                    # SMS sending via Aakash SMS API
│   ├── sound.ts                  # Sound effect playback
│   ├── version.ts                # App version helpers
│   ├── gsm-7.ts                  # GSM-7 encoding for SMS
│   ├── image.ts                  # Image processing helpers
│   ├── offline/db.ts             # IndexedDB wrapper (idb) for offline storage
│   ├── supabase/admin.ts         # Service-role admin client (server-side only)
│   ├── supabase/client.ts        # Browser-side Supabase client
│   ├── supabase/server.ts        # Server-side Supabase SSR client
│   └── types/
│       ├── database.ts           # Row/Insert/Update types for all DB tables
│       └── sms-billing.ts        # SMS_PACKAGES constants + eSewa types
│
├── middleware.ts                  # Middleware (route protection, session check, role guard)
├── types/                        # TypeScript declarations
└── __mocks__/                    # Test mocks

public/
├── sw.js                         # Service worker (cache-first, network-first, auth bypass)
├── manifest.json                 # PWA manifest
├── icons/                        # PWA icons
├── robots.txt
└── favicon.ico

supabase/migrations/              # 46 SQL migrations (001-045, 099)
docs/                             # Product docs, DB schema, architecture
```

---

## Authentication System

Two independent auth systems that coexist:

### 1. Custom Session Cookie (primary)
- HMAC-SHA256 signed token: `userId.issuedAt.expiresAt.signature`
- `issuedAt` (iat) millisecond timestamp enables force-logout comparison
- Secret: `SESSION_HMAC_SECRET` env var (bridged via `next.config.ts` to Edge runtime)
- Cookie: `"session"`, HTTP-only, Secure, SameSite=Lax, 30-day TTL
- Set by server actions: `registerNewUser()`, `loginWithPin()`, `setPin()`
- Verified by middleware (middleware.ts) and `/api/auth/session`

### 2. Supabase Auth (legacy/fallback)
- Uses `@supabase/ssr` for SSR cookie handling
- `supabase.auth.getUser()` with 5-second timeout in middleware
- Falls back to Supabase if custom session is absent

### Auth Flow — New User Registration

```
Welcome → "Create a New Account"
  → Phone step (authMode=register)
  → handlePhoneSubmit → checkUserExists → !exists
  → sendRegistrationOtp → OTP step
  → handleOtpSubmit → verifyRegistrationOtp → !exists
  → select_role step (register mode) — user picks Merchant or Customer
  → handleRoleSelect → registerNewUser(phone, role)
  → set_pin step
  → handleSetPin → setPin(userId, pin) → sets session cookie
  → redirect to dashboard
```

### Auth Flow — Existing User Sign-in (Single Role)

```
Welcome → "Sign In to Existing Account"
  → Phone step (authMode=signin)
  → handlePhoneSubmit → checkUserExists → exists, 1 user, hasPin
  → PIN step
  → handlePinSubmit → loginWithPin → sets session cookie
  → redirect to dashboard
```

### Auth Flow — Existing User Sign-in (Dual Role)

```
... → checkUserExists → exists, userType="both"
  → select_role step (login mode) — user picks Merchant or Customer
  → handleRoleSelect → checkUserExists again for PIN check
  → hasPin → PIN step → handlePinSubmit → redirect
  → !hasPin → set_pin step → handleSetPin → redirect
```

### Auth Flow — Add Role (OtherRolePrompt)

```
OtherRolePrompt component (on merchant or customer dashboard)
  → "Register as Customer" / "Register as Shop Owner"
  → window.location.replace("/login?addRole=customer")
  → Login page mount detects ?addRole= parameter
  → Sets addRoleTarget state, skips auto-redirect
  → Shows phone step (pre-fills from localStorage if available)
  → handlePhoneSubmit → addRoleTarget set → sendRegistrationOtp → OTP step
  → handleOtpSubmit → addRoleTarget set → guard: already has this role?
  → registerNewUser(phone, addRoleTarget) — reuses existing userId
  → set_pin step → handleSetPin → redirect to dashboard
```

### Auth Flow — Forgot PIN

```
PIN step → "Forgot PIN?"
  → forgot_phone step
  → handleForgotPhoneSubmit → forgotPinSendOtp → sendRegistrationOtp
  → forgot_otp step
  → handleForgotOtpSubmit → forgotPinVerifyOtp → verify OTP + setPin
  → sets session cookie → redirect to dashboard
```

### Shared userId Architecture

Dual-role users (both merchant and customer) share the **same UUID** across both `merchants` and `customers` tables. When `registerNewUser()` detects that the phone already exists in the other table, it reuses the existing `id` for the new role row. This enables the session API to look up roles by a single userId.

```
registerNewUser(phone="9841234567", role="customer")
  → findUserByPhone → merchant exists with id="abc-123"
  → reuse id="abc-123" for customer row
  → INSERT INTO customers (id, phone) VALUES ('abc-123', '9841234567')
```

### Session Lifecycle

1. **Creation:** `createSessionToken(userId)` generates `userId.iat.expiresAt.signature`
2. **Storage:** HTTP-only cookie named `"session"`, 30-day TTL
3. **Verification:** `verifySessionToken(token)` checks HMAC signature and expiry
4. **Force logout:** Middleware compares `iat` against `merchants.force_logout_at`
5. **Sign-out:** Client clears all storage → server clears all cookies → redirect to `/login?signedOut=1`

### Role Selection Logic

The login page uses a multi-step state machine:

```
"loading" | "welcome" | "phone" | "pin" | "set_pin" | "otp" | "select_role"
"forgot_phone" | "forgot_otp" | "post_signout_role"
```

`selectRoleMode` distinguishes between `"register"` (new user) and `"login"` (existing multi-role user).

### Post Sign-Out Quick Re-login

On sign-out, `signOut()` saves `{ phone, isDualRole }` to `localStorage("qr_hisab_last_session")`. On next login page mount:
- If `isDualRole`: shows `"post_signout_role"` step ("Continue as Merchant" / "Continue as Customer")
- If single role: pre-fills phone and shows PIN step

---

## Middleware (middleware.ts)

Runs on all routes except static assets. Order of operations:

1. **Public routes** (`/`, `/login`, `/select-role`, `/scan`, `/onboard`, `/verify`, `/_not-found`) → pass through immediately
2. **Domain routing:** `qrhisab.com/*` → redirects to `app.qrhisab.com/*`
3. **Supabase getUser** → 5-second timeout via `Promise.race`
4. **Custom session cookie** → `verifySessionToken()` → extracts `userId` and `iat`
5. **auth_bypass cookie** → dev-only escape hatch
6. **Role lookup** → queries `merchants` + `customers` tables via service-role client
7. **Merchant guard** → `/merchant/*` requires auth + merchant role
8. **Customer guard** → `/customer/*` requires valid `customer_session` cookie
9. **Admin guard** → `/admin/*` requires separate `admin_session` cookie
10. **Force logout** → if `iat < merchants.force_logout_at`, delete session + redirect to `/login?forceLogout=1`

---

## Database (Supabase Postgres)

46 migrations applied (001–045, 099). 16 tables + 1 materialized view.

Full schema documentation → [`docs/database_schema.md`](docs/database_schema.md)

| Table | Purpose |
|-------|---------|
| `merchants` | Shop accounts (id, phone, pin_hash, business_type, sms_balance, force_logout_at, payment_enabled) |
| `customers` | Customer accounts (id, phone, pin_hash, trust_status, address) |
| `merchant_customers` | Junction (merchant_id, customer_id, credit_limit, nickname) |
| `credit_logs` | Transaction ledger (amount, type, status, initiated_by, idempotency_key) |
| `sessions` | Login session records (merchant_id, device_info, ip_address) |
| `audit_logs` | Auto-created audit trail via trigger (actor_id, action_type, old_data, new_data) |
| `admins` | Admin accounts (email, password_hash) |
| `app_settings` | Key-value application settings |
| `merchant_payment_methods` | QR/bank/cash payment configs per merchant |
| `merchant_reminder_settings` | Auto-reminder template + day-of-month |
| `payment_reminder_logs` | SMS share-link delivery history |
| `sms_recharge_logs` | eSewa payment logs (amount, sms_count, transaction_uuid, esewa_ref_id, status) |
| `sms_requests` | Manual SMS recharge requests (pending/approved/rejected) |
| `short_links` | Short URLs for customer verification |
| `merchant_ai_usage` | Gemini AI token usage tracking |
| `rate_limits` | Database-backed rate limiting |
| `customer_summary` | Materialized view for dashboard aggregations |

---

## State Management

- **No global state library** (no Redux, Zustand, etc.)
- **React context**: `AuthProvider` for auth state, `Toast` for notifications
- **localStorage**: `merchant_id`, `merchant_phone`, `sajilo_customer_session`, `qr_hisab_last_session`, `active_role`, `sw_version`, `pwa-install-dismissed`, theme preference
- **IndexedDB** (via `idb`): Offline pending logs, cached customers, settings
- **Cookies**: `session` (HTTP-only), `customer_session` (readable), admin session, OTP temp cookies

---

## localStorage Keys

| Key | Purpose |
|-----|---------|
| `merchant_id` | User's UUID (source of truth for client auth) |
| `merchant_phone` | User's phone (10 digits) |
| `sajilo_customer_session` | JSON `{ phone, name }` for customer context |
| `qr_hisab_last_session` | JSON `{ phone, isDualRole }` for quick re-login after sign-out |
| `qr_hisab_auth_<phone>` | Timestamp of last PIN verification (24h TTL for CustomerPinGate) |
| `active_role` | `"merchant"` or `"customer"` — used by RoleSwitcher |
| `sw_version` | Service worker version (preserved across wipes) |
| `pwa-install-dismissed` | PWA prompt dismissal (preserved across wipes) |

---

## Cookies

| Name | Type | Purpose |
|------|------|---------|
| `session` | httpOnly | HMAC-signed session token (userId.iat.expiresAt.signature) |
| `customer_session` | readable | JSON `{ phone, name }` for customer route protection |
| `otp_code` | httpOnly | 6-digit OTP code (5 min TTL) |
| `otp_phone` | httpOnly | Phone for OTP verification (5 min TTL) |
| `auth_bypass` | readable | Dev bypass flag |
| `admin_session` | httpOnly | Admin session token (separate system) |

---

## Session Revocation (Kill-Switch)

The `force_logout_at` column on the `merchants` table enables an admin to globally invalidate all sessions for a compromised merchant account.

### Flow

```
Admin sets merchants.force_logout_at = NOW()
         │
         ▼
Next request from merchant hits middleware (middleware.ts)
         │
         ├── verifySessionToken(rawCookie)
         │       │
         │       └── Returns { userId, iat } (issued-at ms timestamp)
         │
         ├── DB query: SELECT force_logout_at FROM merchants WHERE id = userId
         │
         └── Compare: iat < Date(force_logout_at).getTime()
                 │
           ┌─────┴─────┐
           ▼           ▼
       iat <        iat >=
     forceLogout   forceLogout
           │           │
           ▼           ▼
    Delete session   Allow request
    cookie +         to proceed
    redirect to
    /login?forceLogout=1
```

### Key files
- **`src/lib/session.ts`** — Token format: `userId.iat.expiresAt.sig`; `verifySessionToken()` returns `{ userId, iat } | null`
- **`src/middleware.ts`** — Middleware compares `iat` against `merchant.force_logout_at`; clears session cookie and redirects if revoked
- **`src/app/api/auth/session/route.ts`** — Same comparison in the API endpoint for client-side session checks

---

## Sign Out Flow

```
signOut() [src/lib/auth.ts]
  → Fire-and-forget: supabase.auth.signOut()
  → Preserve: sw_version, pwa-install-dismissed
  → Save: qr_hisab_last_session { phone, isDualRole }
  → Wipe: localStorage, sessionStorage, cookies, IndexedDB, SW caches
  → Restore: sw_version, pwa-install-dismissed, qr_hisab_last_session
  → Send SKIP_WAITING to SW
  → window.location.replace("/api/auth/signout")
      │
      ▼
GET /api/auth/signout [src/app/api/auth/signout/route.ts]
  → Clear session, admin_session, auth_bypass, customer_session cookies
  → Redirect to /login?signedOut=1
      │
      ▼
Login page mount
  → Detects ?signedOut → shows welcome step
  → If qr_hisab_last_session exists → shows post_signout_role step
```

---

## Dual-Role Architecture

A single user can be both a merchant and a customer. The system supports this through:

1. **Shared userId:** Same UUID in both `merchants` and `customers` tables
2. **Session API:** `/api/auth/session` queries both tables by userId, returns `roles[]` array
3. **Role selection:** `/select-role` page for dual-role users to pick their view
4. **RoleSwitcher component:** Toggle between views without re-authenticating
5. **OtherRolePrompt component:** Prompt single-role users to register for the other role
6. **Post sign-out:** Quick re-login option for dual-role users

---

## Role-Based Redirect Flow

After authentication, users are redirected based on their roles (fetched from `/api/auth/session`):

```
Merchant only  → /merchant/dashboard   (label: "Redirecting to merchant dashboard...")
Customer only  → /customer/dashboard   (label: "Redirecting to customer dashboard...")
Both roles     → /select-role           (label: "Loading your account...")
No role        → stay on current page
```

Two locations implement this:

### Landing Page (`/`)
- `useEffect` fetches `/api/auth/session` on mount
- Reads `data.roles` array to determine redirect target
- Shows a full-screen spinner with role label
- Has `sessionCheckedRef` guard to prevent double-execution

### Login Page (`/login`)
- Same redirect logic on mount (silent session check)
- After PIN/OTP verification, redirects to appropriate dashboard
- PIN entry screen shows role badge ("Merchant" or "Customer") after phone lookup

The `/select-role` page handles dual-role users with a "Choose your view" UI.

---

## Onboarding Gates & Infinite Render Loop Prevention

Three onboarding gates check profile completeness and show a non-dismissible modal if data is missing. Each uses a **`useRef` short-circuit guard** to prevent React error #310 (maximum update depth exceeded).

### Gate Locations

| Page | Trigger Condition | Modal |
|------|------------------|-------|
| `/merchant/dashboard` | `!name \|\| !address \|\| !business_type` | `MerchantOnboardingModal` |
| `/customer/dashboard` | `!name \|\| !address` | `CustomerOnboardingModal` |
| `/verify` | `!customers.name \|\| !customers.address` | `CustomerOnboardingModal` |

### Guard Pattern

```tsx
const ref = useRef(false);

useEffect(() => {
  if (ref.current) return;    // ← top-level short-circuit
  ref.current = true;         // ← set immediately
  // ... fetch data, check completeness
}, [deps]);
```

The ref is set to `true` *before* the completeness check to prevent re-entry. The completion callback only sets `ref.current = true` and closes the modal — it **never re-fetches** the profile from the server.

Full audit: [`docs/infinite-render-loop-audit.md`](docs/infinite-render-loop-audit.md)

---

## Receive Payments Toggle State Guard

The `/merchant/settings` page enforces per-method validation before a merchant can enable a payment method via the toggle switch.

### Validation rules (`canToggleMethod()`)

| Method | Required fields to enable |
|--------|--------------------------|
| Fonepay QR | `qr_url` must be non-null |
| E-Sewa | `qr_url` must be non-null |
| Khalti | `qr_url` must be non-null |
| NepalPay | `qr_url` must be non-null |
| Bank Deposit | `account_holder` + `account_number` both non-null |
| Cash | Always toggleable (no required fields) |

### Key files
- **`src/app/merchant/settings/page.tsx`** — `canToggleMethod()` helper, toggle `onChange` handler with pre-validation
- **`src/app/actions/merchant.ts`** — `upsertMerchantPaymentMethod()` server action persists to DB

---

## Offline Strategy

- **Service worker** (`sw.js`): Network-first for navigations + static assets, cache-fallback with `/` as last resort. Static asset list includes `/onboard`, `/merchant/billing`.
- **IndexedDB** (`src/lib/offline/db.ts`): Pending credit logs (with optional product items), and photo attachments stored offline with per-item sync status (`"offline_pending"` | `"syncing"` | `"failed"`).
- **Sync queue** (`src/components/SyncStatus.tsx`): Processes one log at a time with a 15-second `Promise.race` timeout. Marks item as `"syncing"` → sends to server → deletes on success, or marks `"failed"` on error/timeout. Handles two queues: credit logs (with items) and photo attachments.
- **Sync trigger**: Auto-starts when browser transitions offline → online via `onOnlineStatusChange` callback.
- **Offline indicator** (inline in `SyncStatus.tsx`): Shows pending count and sync status.
- **Auth routes bypassed**: `/login`, `/api/auth/*` never cached by SW.
- **Formspree bypassed**: Feedback form POSTs go directly to network.

---

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (HMAC secret + admin client) |
| `SESSION_HMAC_SECRET` | Dedicated HMAC key (bridged to Edge via `next.config.ts`) |
| `AAKASH_SMS_TOKEN` | SMS API token for OTP delivery via Aakash SMS |
| `ESEWA_PRODUCT_CODE` | eSewa merchant product code (default `EPAYTEST` for UAT) |
| `ESEWA_SECRET_KEY` | eSewa HMAC-SHA256 secret |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for eSewa success/failure redirects |

---

## SMS Credit Management Flow

### Merchant-Initiated SMS (Payment Reminders)

```
Merchant clicks "Send Reminder"
         │
         ▼
  sendPaymentReminder() / checkAndSendAutoReminders()
         │
         ▼
  sendTransactionSMS(to, message, merchantId)
         │
         ├── [No merchantId] → System SMS (OTP, onboarding) — skip guard
         │
         └── [merchantId provided]
                 │
                 ▼
          SMS Balance Guard
           SELECT sms_balance FROM merchants WHERE id = merchantId
                 │
         ┌───────┴───────┐
         ▼               ▼
    sms_balance      sms_balance
       <= 0             >  0
         │               │
         ▼               ▼
   Return error      Proceed to
   INSUFFICIENT_     Aakash SMS API
   SMS_CREDIT        POST /sms/v3/send
                         │
                    ┌────┴────┐
                    ▼         ▼
                 Success    Failure
                    │         │
                    ▼         ▼
              decrement_   Return
              sms_balance  error
              (atomic RPC)
```

### eSewa Recharge Flow

```
Merchant clicks "Buy Now" on /merchant/billing
         │
         ▼
  initiateEsewaPayment(merchantId, packageType)
         │
         ├── Determine package (small/medium/large)
         │    101→50sms, 201→110sms, 501→300sms
         │
         ├── Generate unique transaction_uuid
         │
         ├── INSERT pending row INTO sms_recharge_logs
         │
         ├── Generate HMAC-SHA256 signature
         │    data: "total_amount=X,transaction_uuid=Y,product_code=EPAYTEST"
         │    key:  ESEWA_SECRET_KEY
         │    algo: SHA256 → Base64
         │
         └── Return formParams to client
                 │
                 ▼
         Build hidden HTML <form>
         action = https://uat.esewa.com.np/epay/main
         method = POST
         fields: amt, psc, pdc, txAmt, tAmt, pid, scd, su, fu
                 │
                 ▼
         Browser auto-submits to eSewa
         User logs in with test MPIN + OTP
                 │
                 ▼
         eSewa POSTs to /api/merchant/billing/callback
         Body: data=<Base64-encoded JSON>
                 │
                 ▼
         verifyEsewaPayment(encodedData)
                 │
         ├── Base64 decode → parse JSON
         │    { transaction_code, status, total_amount,
         │      transaction_uuid, signature }
         │
         ├── Verify status === "COMPLETE"
         │
         ├── Recalculate HMAC-SHA256 signature locally
         │    Compare with response signature
         │
         ├── Idempotency checks:
         │    • transaction_uuid not already completed
         │    • esewa_ref_id not already used
         │
         ├── UPDATE sms_recharge_logs SET status='completed',
         │    esewa_ref_id=transaction_code
         │
         └── increment_sms_balance(merchant_id, sms_count)
                    │
                    ▼
         Redirect to /merchant/billing/success
         Query: ?status=completed&sms=50
```
