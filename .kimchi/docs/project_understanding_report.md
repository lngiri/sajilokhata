# QR Hisab (Sajilo Khata) — Comprehensive Project Understanding Report

**Date:** 2026-07-25  
**Project root:** `/mnt/d/vscode/SajiloKhata`  
**Repository:** https://github.com/lngiri/sajilokhata.git  
**Branch:** master

---

## 1. Project Purpose

QR Hisab (सजिलो खाता) is a **mobile-first Progressive Web App (PWA)** that digitizes the traditional Nepali *udharo* (credit) ledger for small retail shops (*kirana*, dairy, water delivery, meat, hardware, etc.). The core product thesis is to shift data-entry friction from the merchant to the customer: customers scan a shop QR code and enter their own transactions, while the merchant only reviews and approves.

---

## 2. Main Features

| Feature | Description |
|---------|-------------|
| Customer self-service credit entry | Customer scans merchant QR → enters amount/description → merchant approves. |
| Reverse QR / offline mode | When customer is offline, app generates a data-embedded QR the merchant scans. |
| Product-based entries | Merchants configure products (rate, unit, quantity); selection auto-fills line items. |
| Multi-shop customer ledger | One customer can owe at many shops; each shop sees only its own data. |
| Dual-role accounts | Same phone/UUID can be both merchant and customer. |
| Multi-device merchant login | Concurrent merchant sessions allowed for family/employees. |
| SMS payment reminders | Merchant sends reminder SMS; auto-reminders configurable per merchant. |
| Payment voucher submission | Customer uploads payment proof screenshot as a pending credit entry. |
| Merchant payment methods | Fonepay, eSewa, Khalti, NepalPay QR; bank deposit; cash. |
| SMS credit billing | eSewa payment integration to buy SMS credit packs; manual top-up requests for admin. |
| AI receipt/ledger parsing | Google Gemini 2.5 Flash for description/amount suggestions. |
| Offline-first sync | IndexedDB pending-log queue + Service Worker cache. |
| Dispute resolution | Customer can approve, dispute, or request an amount edit via verification token. |
| Admin panel | Separate admin system for users, disputes, SMS requests, health, analytics, announcements, CMS, storage, branding. |
| Reports & analytics | Outstanding, received, cash sales, top customers, daily breakdown. |
| Dark mode | Full light/dark theme support. |

---

## 3. User Roles

1. **Merchant / Shop Owner** — manages shop, customers, approves entries, sends reminders, buys SMS credits.
2. **Customer** — scans QR, submits credit/payment requests, views history, disputes entries.
3. **Admin** — platform super-user with separate auth; manages disputes, SMS requests, users, announcements, branding, health checks.
4. **System** — background/audit actor.

A single human can hold **both Merchant and Customer roles** with the same UUID.

---

## 4. Authentication Flow

Two co-existing authentication systems:

### A. Custom HMAC-SHA256 Session Cookie (primary)
- Token format: `userId.iat.expiresAt.signature`
- Cookie name: `session`, HTTP-only, Secure, SameSite=Lax, 30-day TTL.
- Issued by: `registerNewUser`, `loginWithPin`, `setPin`.
- Verified by: `middleware.ts`, `/api/auth/session`.
- Force-logout: session `iat` compared against `merchants.force_logout_at`.

### B. Supabase Auth (legacy/fallback)
- Used when custom session is absent.
- SSR cookie handling via `@supabase/ssr`.

### Customer Session Cookie
- Cookie name: `customer_session`, HMAC-signed.
- Format: `phone.iat.expiresAt[.name].signature`.
- Middleware validates this for `/customer/*` routes.

### Admin Session
- Completely isolated from merchant/customer auth.
- Cookie name: `admin_session`, separate HMAC key in `lib/admin-session.ts`.

---

## 5. Registration Flow

```
Welcome → "Create a New Account"
  → Phone step (authMode=register)
  → checkUserExists()
  → sendRegistrationOtp() → SMS via Aakash SMS
  → OTP verify step
  → verifyRegistrationOtp()
  → select_role step (register mode) — choose Merchant or Customer
  → registerNewUser(phone, role, name)
  → set_pin step
  → setPin(userId, pin) → sets session cookie
  → redirect to dashboard
```

- OTP stored in httpOnly cookies `otp_code` + `otp_phone`, 5-minute TTL.
- New merchant defaults: `business_type="kirana"`, `sms_balance=10`.
- New customer defaults: `name="Customer"`.

---

## 6. Login Flow

### Existing Single-Role User
```
Welcome → "Sign In"
  → Phone step
  → checkUserExists() → exists, single role, hasPin
  → PIN step
  → loginWithPin() → session cookie
  → redirect to /merchant/dashboard or /customer/dashboard
```

### Existing Dual-Role User
```
Phone step
  → checkUserExists() → userType="both"
  → select_role step (login mode)
  → chosen role → check hasPin → PIN step or set_pin step
  → loginWithPin() / setPin() → redirect
```

### Add-Role Flow
```
OtherRolePrompt on dashboard
  → /login?addRole=customer|merchant
  → pre-filled phone, OTP, verify
  → registerNewUser() reuses existing UUID for the missing role
  → set_pin → redirect
```

### Forgot PIN
```
PIN step → "Forgot PIN?"
  → forgot_phone → sendRegistrationOtp()
  → forgot_otp → forgotPinVerifyOtp() → setPin()
```

---

## 7. Merchant Workflow

1. **Onboarding** — Register as merchant, set PIN, complete profile (name, address, business_type) via `MerchantOnboardingModal`.
2. **Dashboard** — View money to collect, today's cash, customer count, pending approvals; quick actions for manual entry and products.
3. **Customers** — Search/add customers, view per-customer balance, credit limit, trust status, transaction history.
4. **QR Code** — Generate/print shop QR code (`/merchant/qr`).
5. **Logs** — Review pending/unverified/disputed/edit_requested entries; approve/reject.
6. **Manual Entry** — `/merchant/scan?manual=true` or cash-sales page; merchant creates entry directly.
7. **Products** — CRUD product master; products drive line-item entry form.
8. **Billing** — View SMS balance, buy SMS packs via eSewa, submit manual top-up requests.
9. **Settings** — Profile, payment methods, reminder settings, change PIN.
10. **Reports** — Date-range analytics and exports.

---

## 8. Customer Workflow

1. **Onboarding** — Register as customer, set PIN, complete name/address via `CustomerOnboardingModal`.
2. **Dashboard** — View total outstanding across shops, per-shop balances, pending transactions.
3. **Scan Shop QR** — Scan merchant QR → enter amount/description → submit debit (credit taken) or credit (payment).
4. **Offline / Reverse QR** — If offline, generate a QR for the merchant to scan.
5. **History** — View all entries per shop; cancel pending entries; confirm/dispute unverified entries.
6. **Payment** — View merchant payment methods, upload payment voucher screenshot.
7. **Settings** — Edit profile, avatar, address.

---

## 9. Admin Workflow

1. **Login** — Separate `/admin/login` with email/password + `admin_session` cookie.
2. **Dashboard** — High-level stats.
3. **Users** — List/inspect/merge users; migrate phone numbers.
4. **Disputes** — Review disputed/edit_requested entries.
5. **SMS Requests** — Approve/reject manual SMS credit top-ups submitted by merchants.
6. **Sessions** — View active merchant sessions.
7. **Analytics / Alerts / Health / Storage / Branding / CMS / Announcements** — Platform management.

---

## 10. SMS Flow

### OTP / Onboarding SMS
- `sendRegistrationOtp()` → `sendTransactionSMS()` without merchantId → does **not** decrement SMS balance.
- Aakash SMS API: `POST https://sms.aakashsms.com/sms/v3/send`.

### Merchant-Initiated Transaction/Reminder SMS
- `sendPaymentReminder()`, `checkAndSendAutoReminders()`, `sendTransactionNotification()`.
- `sendTransactionSMS(to, message, merchantId)` checks `merchants.sms_balance > 0`.
- On success, calls `decrement_sms_balance()` RPC.
- Message length capped at 150 chars.

### SMS Credit Purchase
- Merchant selects pack → `initiateEsewaPayment()` → auto-submits hidden form to eSewa UAT.
- eSewa POSTs to `/api/merchant/billing/callback` → `verifyEsewaPayment()`.
- On success: update `sms_recharge_logs` status, call `increment_sms_balance()` RPC.
- Manual top-ups go to `sms_requests` for admin approval.

---

## 11. OTP Flow

- 6-digit numeric code generated server-side.
- Stored in httpOnly cookies `otp_code` + `otp_phone`, 5-minute TTL.
- Verified by `verifyRegistrationOtp()`; clears cookies on success.
- Used for registration, forgot PIN, and add-role flows.

---

## 12. Credit Transaction Flow

### Customer-Initiated Entry
```
Customer scans QR → submitCustomerEntry()
  → verify customer_session cookie
  → find/create customer by phone
  → link customer to merchant (credit_limit default 5000)
  → INSERT credit_logs(status='pending', initiated_by='customer')
  → notify merchant
```

### Merchant Manual Entry
```
Merchant creates entry → saveEntry() / createManualCreditLog()
  → cash → status='approved' immediately
  → debit/credit → status='unverified'
  → send verification_token to customer (SMS/WhatsApp link)
```

### Verification / Dispute
```
Customer opens /verify?token=...
  → approve → status='approved' (credit limit enforced by trigger)
  → dispute → status='disputed'
  → edit request → status='edit_requested' + proposed_amount
```

### Statuses
`pending`, `unverified`, `approved`, `disputed`, `rejected`, `edit_requested`.

---

## 13. Manual Entry Flow

- Merchants use `/merchant/scan?manual=true` or `/merchant/cash-sales`.
- `saveEntry()` server action handles creation with optional customer creation/linking.
- Cash sales do not require a customer and are auto-approved.
- Debit/credit entries can include product line items (`credit_log_items`).

---

## 14. Payment Flow

1. **Customer views merchant payment methods** via `getMerchantPaymentMethodsPublic()`.
2. **Customer uploads payment voucher** → `submitPaymentVoucher()` → stores screenshot in Supabase storage, creates `credit_logs(status='pending', type='credit', initiated_by='customer')`.
3. **Merchant reviews** and approves/rejects in logs page.
4. **QR-based payments** (Fonepay/eSewa/Khalti/NepalPay) are external; merchant toggles methods in settings.

---

## 15. Notification Flow

- Table: `notifications` (user_id, user_type, type, title, body, reference_id, reference_type, read, created_at).
- Created by server actions: `createNotification()`.
- Types: `entry_created`, `entry_approved`, `entry_rejected`, `entry_disputed`, `edit_requested`, `edit_accepted`, `edit_rejected`, `payment_voucher`, `customer_linked`, `credit_limit_changed`, `payment_reminder`.
- Dashboards subscribe to Supabase Realtime on `notifications` table.
- Unread counts shown in header bell icons.

---

## 16. Database Structure

**Engine:** Supabase (PostgreSQL + PostGIS).  
**Migrations:** 46 files (`supabase/migrations/001-045, 099`).  
**Tables (18):**

| Table | Purpose |
|-------|---------|
| `merchants` | Shop accounts, profile, PIN hash, SMS balance, force-logout kill-switch. |
| `customers` | Customer accounts, trust status, address. |
| `merchant_customers` | Junction with credit_limit and nickname. |
| `credit_logs` | Transaction ledger; statuses + verification_token. |
| `credit_log_items` | Line items for product-based entries. |
| `sessions` | Login session records. |
| `audit_logs` | Auto-generated audit trail via trigger. |
| `admins` | Admin accounts (separate auth). |
| `app_settings` | Key-value app config. |
| `merchant_payment_methods` | Payment method config per merchant. |
| `merchant_reminder_settings` | Auto-reminder template + day. |
| `payment_reminder_logs` | SMS/share-link reminder history. |
| `sms_recharge_logs` | eSewa recharge records. |
| `sms_requests` | Manual SMS top-up requests. |
| `short_links` | Short URLs for customer verification. |
| `merchant_ai_usage` | Daily Gemini token tracking. |
| `rate_limits` | DB-backed rate limiting. |
| `merchant_products` | Product master catalog per merchant. |
| `customer_invites` | (referenced in customer.ts) onboarding invite tracking. |
| `notifications` | In-app notification store. |

**Materialized view:** `customer_summary` — per-merchant/customer aggregations.

**Key stored functions:**
- `check_credit_limit()` — trigger-enforced credit cap.
- `process_audit_log()` — auto audit.
- `decrement_sms_balance()` / `increment_sms_balance()` / `decrement_sms_balance_bulk()`.
- `get_customer_balance()` — approved balance.
- `import_customers()` — bulk import JSON.
- `get_user_directory_safe()` — dual-role detection.

---

## 17. API Structure

### App Router API Routes (`src/app/api/`)

| Route | Purpose |
|-------|---------|
| `api/auth/session` | Returns current user roles/IDs. |
| `api/auth/signout` | Clears all auth cookies. |
| `api/auth/bypass` | Dev bypass (hardened in prod). |
| `api/customer/session` | Sets HMAC-signed `customer_session` cookie. |
| `api/customer/clear-session` | Clears customer session cookie. |
| `api/merchant/billing/callback` | eSewa payment callback. |
| `api/merchant/profile` | Merchant profile update. |
| `api/merchant/setup` | Merchant onboarding setup. |
| `api/merchant/upload-payment-qr` | QR image upload. |
| `api/merchant/upload-photo` | Merchant photo upload. |
| `api/verify/*` | Approve, dispute, edit-request, accept-edit, reject-edit, complete-registration, lookup-invite, confirm-invite. |
| `api/v/[code]` | Short-link redirection. |
| `api/ai/parse-bill` | Gemini receipt parsing. |
| `api/feedback` | Formspree feedback proxy. |
| `api/admin/*` | Admin stats, users, disputes, alerts, settings, health, login, session, signout, upload. |

### Server Actions (`src/app/actions/`)

| File | Domain |
|------|--------|
| `otp.ts` | OTP generation/verification. |
| `pin.ts` | PIN set/verify/login, registration. |
| `session.ts` | Session heartbeat. |
| `merchant.ts` | Merchant dashboard, customers, logs, payment methods, reminders, vouchers. |
| `customer.ts` | Customer profile, entry submission, history, avatar. |
| `entry.ts` | Core credit log save with items. |
| `sms.ts` | SMS sending. |
| `sms-billing.ts` | eSewa billing + manual SMS requests. |
| `notifications.ts` | Notification CRUD. |
| `products.ts` | Product master CRUD. |
| `admin.ts` | Admin auth/actions. |
| `import-customers.ts` | Bulk customer import. |
| `customer-pin.ts` | Customer PIN gate actions. |

---

## 18. Folder Structure

```
/mnt/d/vscode/SajiloKhata/
├── src/
│   ├── app/                 # Next.js App Router pages + API + server actions
│   │   ├── actions/         # Server Actions
│   │   ├── admin/           # Admin panel pages
│   │   ├── api/             # API route handlers
│   │   ├── business/[merchantId]/  # Public merchant landing
│   │   ├── customer/        # Customer pages
│   │   ├── login/           # Auth wizard
│   │   ├── merchant/        # Merchant pages
│   │   ├── onboard/         # Customer onboarding with OTP
│   │   ├── scan/            # Guest customer QR scan flow
│   │   ├── select-role/     # Dual-role picker
│   │   ├── verify/          # Verification/dispute page
│   │   ├── layout.tsx       # Root layout
│   │   ├── globals.css      # Tailwind + CSS variables
│   │   └── ...
│   ├── components/          # Shared React components (~30 files)
│   ├── lib/                 # Utilities, auth, sessions, offline DB, SMS
│   ├── middleware.ts        # Route protection + session verification
│   └── types/               # TypeScript declarations
├── supabase/migrations/     # 46 SQL migrations
├── public/                  # Static assets, sw.js, manifest.json, icons
├── docs/                    # Product docs, schema, architecture
├── e2e/                     # Playwright tests
└── scripts/                 # Admin/diagnostic scripts
```

---

## 19. Component Architecture

- **No global state library** (no Redux/Zustand).
- **React Context:** `AuthProvider`, `Toast`.
- **Key reusable components:**
  - `BottomNav` / `CustomerBottomNav` — role-specific tab navigation.
  - `RoleSwitcher` — toggles between merchant/customer views.
  - `OtherRolePrompt` — encourages adding the second role.
  - `MerchantOnboardingModal` / `CustomerOnboardingModal` — profile completeness gates.
  - `CustomerPinGate` — PIN re-prompt for customer flows.
  - `QRCode` — QR display + scanner (html5-qrcode).
  - `SyncStatus` / `OfflineIndicator` — offline queue UI.
  - `PendingApprovalModal` — post-submission confirmation.
  - `PullToRefresh` — mobile pull-to-refresh wrapper.
  - `Toast` — in-app toast notifications.
  - `ActionHub` — floating support/refer/feedback buttons.
  - `NetworkStatus` — online/offline banner.
  - `PWAInstallBanner` — install prompt.
  - `VersionGuard` — app version mismatch detection.
  - `ServiceWorkerRegistrar` — SW registration + cache-bust.

---

## 20. State Management

- **Server state:** Supabase queries via service-role server actions (preferred) or browser-side `@supabase/supabase-js` client (legacy `lib/actions.ts`).
- **Client state:** React `useState`/`useEffect` + `useCallback` per page.
- **Auth state:** `localStorage` keys (`merchant_id`, `merchant_phone`, `sajilo_customer_session`, `qr_hisab_last_session`, `active_role`, `qr_hisab_auth_<phone>`).
- **Offline state:** IndexedDB (`idb`) for pending logs, attachments, cached customers, settings.
- **Cookies:** `session`, `customer_session`, `admin_session`, `otp_code`, `otp_phone`.

---

## 21. Styling System

- **Tailwind CSS v4** with PostCSS.
- **CSS variables** defined in `src/app/globals.css` for theming.
- **Color tokens:** `--color-primary`, `--color-primary-light`, `--color-primary-dark`, `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-danger`, `--color-accent`.
- **Dark mode:** `.dark` class overrides all CSS variables.
- **Mobile-first:** `min-h-dvh`, `safe-area-inset`, 44px touch targets, rounded 2xl cards.
- **Animations:** custom keyframes for fade-in, slide-up, scale-up, pulse-soft, bounce-subtle, number-shine, draw-stroke.
- **Admin theme:** separate `admin-theme` CSS variable set.
- **Print styles:** A4 QR print layout.

---

## 22. Design System

- **Language:** Avoids negative terms like "debt" / "udharo"; uses "QR Hisab", "Digital Diary", "Account Statement", "Money to Collect".
- **Visual style:** Green primary (#16A34A), rounded 2xl surfaces, soft shadows, card-based layout, sticky headers, bottom navigation.
- **Icons:** Heroicons-style SVG inline.
- **Typography:** System sans-serif, font-mono for phone numbers.
- **Accessibility:** ARIA labels, focus rings, reduced motion not explicitly present but tap highlights removed.

---

## 23. Existing Coding Conventions

- TypeScript with `any` tolerated in DB-heavy files (`// eslint-disable-next-line @typescript-eslint/no-explicit-any`).
- Server actions are organized by domain under `src/app/actions/`.
- `getAdminClient()` from `lib/supabase/admin.ts` is used server-side for RLS-bypass operations.
- Browser-side Supabase client lives in `lib/supabase/client.ts` and is used by legacy `lib/actions.ts`.
- Phone normalization: `normalizePhone()` in `lib/phone.ts` extracts last 10 digits.
- Session verification: `verifySessionToken()` and `verifyCustomerSessionToken()` in `lib/session.ts`.
- Error handling: extensive `console.error` logging; user-facing errors returned as `{ success: boolean; error?: string }`.
- Rate limiting: `lib/rate-limit.ts` in-memory + DB `rate_limits` table.
- Anti-pattern guard: `useRef(false)` to prevent infinite render loops in onboarding gates.

---

## 24. Important Business Rules

1. **Dual-role shared UUID:** Same phone gets the same UUID in `merchants` and `customers` tables.
2. **Credit limit default:** `merchant_customers.credit_limit` defaults to NPR 5,000.
3. **Credit cap enforcement:** Database trigger `trg_check_credit_limit` raises exception if approving a debit would exceed limit.
4. **Balance computation:** Approved `debit` − approved `credit` (excluding `cash`).
5. **Cash sales:** No customer required; auto-approved.
6. **Customer-created entries:** Start as `pending`; merchant-created non-cash entries start as `unverified`.
7. **SMS balance guard:** Merchant-initiated SMS requires `sms_balance > 0` and decrements by 1.
8. **New merchants get 10 free SMS credits.**
9. **eSewa signature verification:** HMAC-SHA256 over `total_amount,transaction_uuid,product_code`.
10. **Manual SMS request idempotency:** `sms:${merchantId}:${transactionId}`.
11. **Customer data isolation:** Merchants see only their own `credit_logs` and `merchant_customers`.
12. **Trust status:** `good` / `warning` / `defaulter`; only the flagging merchant can clear their own flag.
13. **Verification token expiry:** Links are single-use-ish; `/verify` rejects non-`unverified` statuses.
14. **Force logout:** Admin sets `merchants.force_logout_at`; all sessions issued before that time are invalidated.
15. **Domain routing:** `qrhisab.com/*` (except root/static) redirects to `app.qrhisab.com/*`.
16. **Customer route protection:** Requires valid `customer_session` cookie; missing → redirect to `/scan`.

---

## 25. Reusable Components That Must Never Be Duplicated

- `Toast` provider + `useToast` hook.
- `BottomNav` / `CustomerBottomNav`.
- `RoleSwitcher`.
- `LogoWithAbout` / `AppLogo`.
- `QRCode` (scanner + generator).
- `MerchantOnboardingModal` / `CustomerOnboardingModal`.
- `CustomerPinGate`.
- `PendingApprovalModal`.
- `PullToRefresh`.
- `SyncStatus` / `OfflineIndicator`.
- `NetworkStatus`.
- `ActionHub`.
- `SessionGuard` / `AdminGuard`.
- `ThemeSwitcher`.
- `TransactionIcon`.
- `VersionGuard`.
- `ServiceWorkerRegistrar`.

---

## 26. Sensitive Areas Where Changes Could Break Functionality

1. **Authentication/session logic** (`lib/session.ts`, `app/actions/pin.ts`, `middleware.ts`, `app/api/auth/session/route.ts`).
2. **Onboarding gate refs** — removing the `useRef(false)` guard will reintroduce infinite render crashes.
3. **Credit limit trigger** — changes to `check_credit_limit()` or `credit_logs` status logic can allow over-limit transactions.
4. **Offline sync** (`lib/offline/db.ts`, `components/SyncStatus.tsx`) — mishandling queues causes data loss.
5. **eSewa callback signature verification** — weakening it enables payment fraud.
6. **SMS balance guard** — bypassing it allows free SMS abuse.
7. **Customer data isolation** in `merchant.ts` server actions (`requireMerchant()` + `eq("merchant_id", merchantId)`).
8. **Dual-role UUID reuse** in `registerNewUser()`.
9. **Customer session cookie verification** — `customer_session` is the gate for `/customer/*`.
10. **Realtime subscriptions** on dashboards rely on correct `filter` syntax.
11. **Service worker caching** (`public/sw.js`) — aggressive caching can break deployments.
12. **Force logout comparison** (`iat < force_logout_at` milliseconds vs timestamp).

---

## 27. Existing Technical Debt / Architectural Concerns

1. **Two overlapping action layers:** `src/app/actions/merchant.ts` / `customer.ts` (server actions) duplicate logic with legacy `src/lib/actions.ts` (browser-side Supabase client). Some pages still use `lib/actions.ts`.
2. **Missing TypeScript types:** `merchants.payment_enabled`, `sms_requests`, `rate_limits`, `credit_logs.idempotency_key` exist in DB but not in `src/lib/types/database.ts`.
3. **`customer_session` derivation:** Customer dashboard extracts phone from localStorage and cookie; some flows still pass `phone` params that server actions ignore in favor of the cookie.
4. **Hardcoded eSewa test secret:** `ESEWA_SECRET_KEY` has a fallback test value in `sms-billing.ts`.
5. **Admin upload route uses FormData with base64 screenshots** — memory/performance concern at scale.
6. **In-memory rate limiter** is not distributed; does not work across Vercel serverless instances.
7. **SMS gateway dependency on Aakash SMS** — single vendor, Nepal-specific.
8. **`findUserByPhone` / `checkUserExists` queries both merchants and customers** but session logic assumes the UUID exists in both when dual-role.
9. **Several `as any` casts** throughout DB queries reduce type safety.
10. **Customer realtime uses `localStorage.getItem("merchant_id")`** as customer ID — naming is misleading.
11. **Mixed auth bypass handling:** `auth_bypass` cookie was recently hardened; legacy references may remain.
12. **Audit log trigger only watches `credit_logs`** — other tables are not audited.

---

## 28. How the Application Works From a Real User's Perspective

A shopkeeper opens QR Hisab on their phone, registers as a Merchant with their Nepali phone number, verifies an OTP, sets a 4-digit PIN, and enters their shop name, address, and business type. They generate a QR code, print it, and place it at the counter. When a customer buys goods on credit, the customer scans the QR with their own phone, enters the amount and item description, and submits. The shopkeeper receives a notification, opens the Logs page, and taps approve. The customer's outstanding balance updates instantly. At month-end, the shopkeeper taps "Remind" next to high-balance customers; if SMS credits are low, they buy a pack via eSewa. Customers can also pay partially and upload a voucher screenshot, which the merchant approves to reduce the balance.

---

## 29. How the Application Works From a Merchant's Perspective

1. **Register/Login** with phone + OTP + PIN.
2. **Dashboard** shows money to collect, today's cash, customer count, pending entries.
3. **Customers** page lists all linked customers with balances; add new customers by phone.
4. **QR page** generates a shop QR to display/print.
5. **Logs page** is the approval center: pending customer submissions, unverified merchant entries, disputed items, edit requests.
6. **Manual Entry / Cash Sales** lets the merchant record transactions directly.
7. **Products page** manages inventory-style items for faster entry.
8. **Billing page** tracks SMS credits and eSewa recharge.
9. **Settings** updates profile, payment QR codes, auto-reminder templates, PIN.
10. **Reports** show sales, collections, top debtors, daily breakdown.

---

## 30. How the Application Works From a Customer's Perspective

1. **Register/Login** with phone + OTP + PIN (or use `/scan` as a guest with just phone).
2. **Dashboard** shows total outstanding across all shops and a per-shop breakdown.
3. **Scan Shop QR** opens the camera, scans the merchant's QR, enters amount and description, chooses "Credit Taken" or "Payment," and submits.
4. If offline, the app shows a **Reverse QR** for the merchant to scan.
5. **History** lists all entries with status; pending entries can be cancelled; unverified entries can be approved/disputed.
6. **Pay Now** shows merchant payment methods (QR codes, bank details).
7. **Upload Voucher** lets the customer submit a payment screenshot.
8. **Settings** updates name, address, avatar.

---

## 31. Assumptions

1. The primary deployment target is **Vercel** with **Supabase** as the backend.
2. The app is optimized for **Nepali mobile users**; phone numbers are normalized to 10 digits with implicit `+977`.
3. **eSewa UAT** (`uat.esewa.com.np`) is currently wired; production switch likely requires env changes only.
4. **Aakash SMS** is the sole SMS gateway; if it is unavailable, OTP and reminders fail.
5. The codebase is in active stabilization: recent commits focused on security hardening, dark mode, and infinite-render-loop fixes.
6. **Dual-role users** are a first-class concept; changes should preserve shared UUID behavior.
7. The **custom HMAC session cookie** is intended to become the sole auth system; Supabase Auth is legacy/fallback.
8. **Service worker caching** must be manually busted on deployments (`sw_version` in localStorage + cache headers).
9. **Customer routes** rely on a readable (but HMAC-signed) `customer_session` cookie set via `/api/customer/session`.
10. The project uses **Next.js 16 App Router + Turbopack**, React 19, Tailwind 4, and TypeScript 6; no new dependencies should be introduced without explicit instruction.

---

*End of report. No code changes were made. Awaiting next prompt before implementation.*
