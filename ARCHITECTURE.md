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
│   ├── actions/                  # Server Actions (otp, pin, merchant, admin, etc.)
│   ├── admin/                    # Admin panel (dashboard, users, analytics, etc.)
│   ├── api/                      # API route handlers (auth, merchant, sms, verify)
│   ├── business/[merchantId]/    # Public merchant landing page
│   ├── customer/                 # Customer-facing pages (dashboard, history)
│   ├── delivery/                 # Delivery diary page
│   ├── login/                    # Auth wizard (phone → OTP → PIN → dashboard)
│   ├── merchant/                 # Merchant pages (dashboard, logs, customers, qr, settings, scan)
│   ├── onboard/                  # Customer onboarding
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
│   └── supabase/server.ts        # Server-side Supabase SSR client
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

supabase/migrations/              # 21 SQL migrations (001-021)
docs/                             # Legacy product docs
```

---

## Authentication System

Two independent auth systems that coexist:

### 1. Custom Session Cookie (primary)
- HMAC-SHA256 signed token: `{userId}.{expiresAt}.{hexSignature}`
- Secret: `SUPABASE_SERVICE_ROLE_KEY` (fallback: `"session-secret-fallback"`)
- Cookie: `"session"`, HTTP-only, Secure, SameSite=Lax, 30-day TTL
- Set by server actions: `verifyRegistrationOtp()`, `loginWithPin()`, `setPin()`
- Verified by middleware (proxy.ts) and `/api/auth/session`

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

21 migrations applied. Key tables:

| Table | Purpose |
|-------|---------|
| `merchants` | Shop accounts (id, phone, pin_hash, business_type, force_logout_at) |
| `customers` | Customer accounts (id, phone, pin_hash) |
| `merchant_customers` | Junction (merchant_id, customer_id, credit_limit) |
| `credit_logs` | Transaction ledger (amount, type, status, customer_id) |
| `sessions` | Login session records (merchant_id, device_info, ip_address) |
| `audit_logs` | Immutable change tracking |

---

## State Management

- **No global state library** (no Redux, Zustand, etc.)
- **React context**: `AuthProvider` for auth state, `Toast` for notifications
- **localStorage**: `merchant_id`, `merchant_phone`, `sajilo_customer_session`, theme preference
- **IndexedDB** (via `idb`): Offline pending logs, cached customers, settings
- **Cookies**: `session` (HTTP-only), `customer_session` (non-HTTP-only), admin session, OTP temp cookies

---

## Offline Strategy

- **Service worker** (`sw.js`): Network-first for navigations + static assets, cache-fallback with `/` as last resort
- **IndexedDB**: Pending credit logs stored offline, synced when online
- **Auth routes bypassed**: `/login`, `/api/auth/*` never cached by SW
- **Formspree bypassed**: Feedback form POSTs go directly to network

---

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (HMAC secret + admin client) |
| `AAKASH_SMS_TOKEN` | SMS API token for OTP delivery |
