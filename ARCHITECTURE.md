# SajiloKhata (QR Hisab) — Architecture

**Stack:** Next.js 16 (App Router + Turbopack) · React 19 · Supabase (Postgres + Auth) · Tailwind CSS 4 · TypeScript 6 · PWA  
**Runtime:** Node.js server actions + Edge Middleware (proxy.ts)  
**Test:** Vitest + Testing Library  
**Deploy:** Vercel  

---

## Directory Layout

```
src/
├── app/                          # Next.js App Router pages
│   ├── actions/                  # Server Actions (otp, pin, merchant, admin, sms-billing, etc.)
│   ├── admin/                    # Admin panel (dashboard, users, analytics, etc.)
│   ├── api/                      # API route handlers (auth, merchant, sms, verify, billing)
│   │   └── merchant/
│   │       └── billing/
│   │           └── callback/     # eSewa POST callback handler (Base64 decode + verify)
│   ├── business/[merchantId]/    # Public merchant landing page
│   ├── customer/                 # Customer-facing pages (dashboard, history)
│   ├── delivery/                 # Delivery diary page
│   ├── login/                    # Auth wizard (phone → OTP → PIN → dashboard)
│   ├── merchant/                 # Merchant pages (dashboard, logs, customers, qr, billing, settings, scan)
│   │   ├── billing/              # SMS credit recharge (plan cards + auto-submit to eSewa)
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
├── components/                   # Shared UI components
│   ├── ActionHub.tsx             # Floating action hub (support, refer, feedback)
│   ├── AdminGuard.tsx            # Admin route guard (client-side)
│   ├── AuthProvider.tsx          # React context for auth state
│   ├── BottomNav.tsx             # Merchant 5-tab navigation
│   ├── CustomerBottomNav.tsx     # Customer tab navigation
│   ├── CustomerPinGate.tsx       # PIN gate for customer flows
│   ├── FeedbackModal.tsx         # Feedback form (Formspree)
│   ├── NetworkStatus.tsx         # Online/offline banner
│   ├── OfflineIndicator.tsx      # Pending sync count badge
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
│   ├── SyncStatus.tsx            # Offline sync indicator
│   ├── ThemeSwitcher.tsx         # Dark/light theme toggle
│   ├── Toast.tsx                 # Toast notification system
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
│   ├── offline/db.ts             # IndexedDB wrapper (idb) for offline storage
│   ├── supabase/admin.ts         # Service-role admin client (server-side only)
│   ├── supabase/client.ts        # Browser-side Supabase client
│   ├── supabase/server.ts        # Server-side Supabase SSR client
│   └── types/
│       ├── database.ts           # Row/Insert/Update types for all DB tables
│       └── sms-billing.ts        # SMS_PACKAGES constants + EsewaInitResponse/EsewaVerifyResponse types
│
├── proxy.ts                      # Middleware (route protection, session check, role guard)
├── types/                        # TypeScript declarations
└── __mocks__/                    # Test mocks

public/
├── sw.js                         # Service worker (cache-first, network-first, auth bypass)
├── manifest.json                 # PWA manifest
├── icons/                        # PWA icons
├── robots.txt
└── favicon.ico

supabase/migrations/              # 33 SQL migrations (001-033)
docs/                             # Legacy product docs
```

---

## Authentication System

Two independent auth systems that coexist:

### 1. Custom Session Cookie (primary)
- HMAC-SHA256 signed token: `{userId}.{issuedAt}.{expiresAt}.{hexSignature}`
- `issuedAt` (iat) millisecond timestamp enables force-logout comparison
- Secret: `SUPABASE_SERVICE_ROLE_KEY` (fallback: `"session-secret-fallback"`)
- Cookie: `"session"`, HTTP-only, Secure, SameSite=Lax, 30-day TTL
- Set by server actions: `verifyRegistrationOtp()`, `loginWithPin()`, `setPin()`
- Verified by middleware (proxy.ts) and `/api/auth/session`
- Legacy 3-part tokens (`userId.expiresAt.sig`) tolerated for backward compat during rollout

### 2. Supabase Auth (legacy/fallback)
- Uses `@supabase/ssr` for SSR cookie handling
- `supabase.auth.getUser()` with 5-second timeout in middleware
- Falls back to Supabase if custom session is absent

### Auth Flow (new user)
```
Phone → sendRegistrationOtp() → cookie-based OTP
  → verifyRegistrationOtp() → create merchant row + set session cookie
  → setPin() → hash PIN in DB + refresh session cookie
  → redirect to /merchant/dashboard
```

### Auth Flow (returning user)
```
Phone → checkUserExists() → find merchant by phone
  → loginWithPin() → verify bcrypt hash + set session cookie
  → redirect to dashboard
```

---

## Middleware (proxy.ts)

Runs on all routes except static assets. Order of operations:

1. **Public routes** (`/`, `/login`, `/scan`, `/onboard`, etc.) → pass through immediately
2. **Supabase getUser** → 5-second timeout
3. **Custom session cookie** → `verifySessionToken()`
4. **auth_bypass cookie** → dev-only escape hatch
5. **Role lookup** → queries `merchants` + `customers` tables via service-role client
6. **Merchant/delivery guard** → `/merchant/*` requires auth + merchant role
7. **Admin guard** → `/admin/*` requires separate admin session cookie
8. **Customer guard** → `/customer/*` requires `customer_session` cookie

---

## Database (Supabase Postgres)

33 migrations applied (001–033). Key tables:

| Table | Purpose |
|-------|---------|
| `merchants` | Shop accounts (id, phone, pin_hash, business_type, sms_balance, force_logout_at) |
| `customers` | Customer accounts (id, phone, pin_hash, trust_status) |
| `merchant_customers` | Junction (merchant_id, customer_id, credit_limit) |
| `credit_logs` | Transaction ledger (amount, type, status, customer_id, initiated_by, attachment_url) |
| `sessions` | Login session records (merchant_id, device_info, ip_address) |
| `audit_logs` | Immutable change tracking |
| `merchant_payment_methods` | QR/bank/cash payment configs per merchant |
| `merchant_reminder_settings` | Auto-reminder template + day-of-month |
| `payment_reminder_logs` | SMS share-link delivery history |
| `sms_recharge_logs` | eSewa payment logs (amount, sms_count, transaction_uuid, esewa_ref_id, status) |

---

## State Management

- **No global state library** (no Redux, Zustand, etc.)
- **React context**: `AuthProvider` for auth state, `Toast` for notifications
- **localStorage**: `merchant_id`, `merchant_phone`, `sajilo_customer_session`, theme preference
- **IndexedDB** (via `idb`): Offline pending logs, cached customers, settings
- **Cookies**: `session` (HTTP-only), `customer_session` (non-HTTP-only), admin session, OTP temp cookies

---

## Session Revocation (Kill-Switch)

The `force_logout_at` column on the `merchants` table enables an admin to globally invalidate all sessions for a compromised merchant account.

### Flow

```
Admin sets merchants.force_logout_at = NOW()
         │
         ▼
Next request from merchant hits middleware (proxy.ts)
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
- **`src/proxy.ts`** — Middleware compares `iat` against `merchant.force_logout_at`; clears session cookie and redirects if revoked
- **`src/app/api/auth/session/route.ts`** — Same comparison in the API endpoint for client-side session checks

### Legacy token backward compat
Tokens issued before the `iat` field was added (3-part format `userId.expiresAt.sig`) derive an approximate `iat` via `expiresAt - SESSION_DURATION * 1000`. This ensures most existing sessions still participate in the kill-switch check without forcing a global re-login.

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

### UX flow
1. Merchant clicks toggle ON → `canToggleMethod()` runs
2. If validation fails → toast: "Please expand the payment method and enter your details first!" — toggle stays OFF
3. Merchant expands the card using the chevron arrow, fills in required fields, clicks **Save**
4. Method record persists to `merchant_payment_methods` with `is_active: false`
5. Now toggle click passes validation → `upsertMerchantPaymentMethod()` sets `is_active: true`

### Key files
- **`src/app/merchant/settings/page.tsx`** — `canToggleMethod()` helper, toggle `onChange` handler with pre-validation
- **`src/app/actions/merchant.ts`** — `upsertMerchantPaymentMethod()` server action persists to DB

---

## Offline Strategy

- **Service worker** (`sw.js`): Network-first for navigations + static assets, cache-fallback with `/` as last resort. Static asset list includes `/onboard`, `/merchant/billing`.
- **IndexedDB** (`src/lib/offline/db.ts`): Pending credit logs, delivery logs, and photo attachments stored offline with per-item sync status (`"offline_pending"` | `"syncing"` | `"failed"`).
- **Sync queue** (`src/components/SyncStatus.tsx`): Processes one log at a time with a 15-second `Promise.race` timeout. Marks item as `"syncing"` → sends to server → deletes on success, or marks `"failed"` on error/timeout. Handles three queues: credit logs, delivery logs, photo attachments.
- **Sync trigger**: Auto-starts when browser transitions offline → online via `onOnlineStatusChange` callback.
- **Offline indicator** (`src/components/OfflineIndicator.tsx`): Shows amber "Offline Mode — X items pending" when disconnected, blue spinner during sync, green checkmark when fully synced.
- **Auth routes bypassed**: `/login`, `/api/auth/*` never cached by SW.
- **Formspree bypassed**: Feedback form POSTs go directly to network.

---

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (HMAC secret + admin client) |
| `AAKASH_SMS_TOKEN` | SMS API token for OTP delivery via Aakash SMS |
| `ESEWA_PRODUCT_CODE` | eSewa merchant product code (default `EPAYTEST` for UAT) |
| `ESEWA_SECRET_KEY` | eSewa HMAC-SHA256 secret (default `8g8M8maxQPm86ksx` for UAT) |
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
