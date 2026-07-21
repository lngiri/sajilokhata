# QR Hisab (Sajilo Khata) — Project Status

**Date:** July 21, 2026  
**Project:** SajiloKhata / QR Hisab (Digital Credit Ledger)  
**Stack:** Next.js 16 + React 19 + TypeScript 6 + Supabase (PostgreSQL) + Tailwind CSS 4 + PWA  
**Status:** Production Ready

---

## 1. Completed Work

### Database & Schema
- 46 SQL migrations (001–045, 099) applied
- 16 tables: merchants, customers, merchant_customers, credit_logs, sessions, audit_logs, admins, app_settings, merchant_payment_methods, merchant_reminder_settings, payment_reminder_logs, sms_recharge_logs, sms_requests, short_links, merchant_ai_usage, rate_limits
- 1 materialized view: `customer_summary`
- 8 stored functions/RPCs (check_credit_limit, process_audit_log, sms balance management, customer balance, bulk import, user directory)
- 3 active triggers (credit limit check, audit log creation, sms_requests updated_at)
- PostGIS extension for geolocation
- RLS policies on core tables

### Authentication System
- Custom HMAC-SHA256 session cookies (30-day TTL, force-logout support)
- Phone + OTP + PIN hybrid auth flow
- bcrypt PIN hashing (10 rounds)
- Dual-role architecture (shared userId across merchants + customers)
- Add-role flow via OtherRolePrompt → `/login?addRole=` parameter
- Post sign-out quick re-login for dual-role users
- Session heartbeat (periodic refresh)
- SessionGuard (client-side session validation)

### Merchant Features
- Dashboard with credit ledger, customer management, QR generation
- Customer list with balances, credit limits, trust status
- Transaction ledger with status workflow (pending → approved/disputed/rejected)
- QR code generation and scanning
- SMS payment reminders with balance guard
- eSewa SMS credit recharge (web checkout with HMAC verification)
- Photo upload for profile
- Settings with payment method toggles (Fonepay, eSewa, Khalti, NepalPay, Bank, Cash)
- Cash sales mode
- Excel import for bulk customer/transaction entry
- Reports and analytics

### Customer Features
- Customer dashboard with unified view across merchants
- Transaction history
- Settings
- PIN gate for sensitive operations

### Admin Panel
- Dashboard with stats, alerts, sessions
- User directory
- Merchant detail pages
- Force logout kill-switch
- Announcements and CMS

### Offline & PWA
- Service Worker with cache-first strategy
- IndexedDB for offline pending logs
- Sync queue with automatic retry
- PWA install banner with multi-signal detection
- Offline indicator

### Infrastructure
- Vercel deployment
- Edge Middleware for route protection
- API routes for auth, merchant operations, AI parsing, billing
- CORS for cross-domain navigation (qrhisab.com ↔ app.qrhisab.com)

---

## 2. Pages (20+ total)

| Page | Path | Auth |
|------|------|------|
| Home | `/` | Public |
| Login | `/login` | Public |
| Select Role | `/select-role` | Protected |
| Scan | `/scan` | Public |
| Onboard | `/onboard` | Public |
| Products | `/merchant/products` | Protected |
| Verify | `/verify` | Public |
| Merchant Dashboard | `/merchant/dashboard` | Protected |
| Merchant QR | `/merchant/qr` | Protected |
| Merchant Customers | `/merchant/customers` | Protected |
| Merchant Customer Detail | `/merchant/customers/[id]` | Protected |
| Merchant Ledger | `/merchant/logs` | Protected |
| Merchant Settings | `/merchant/settings` | Protected |
| Merchant Billing | `/merchant/billing` | Protected |
| Merchant Cash Sales | `/merchant/cash-sales` | Protected |
| Merchant Reports | `/merchant/reports` | Protected |
| Merchant Import | `/merchant/import` | Protected |
| Customer Dashboard | `/customer/dashboard` | Protected |
| Customer History | `/customer/history` | Protected |
| Customer Settings | `/customer/settings` | Protected |
| Admin Dashboard | `/admin/dashboard` | Admin |

---

## 3. Components (29)

ActionHub, AdminGuard, AmountSuggestions, AuthProvider, BottomNav, CustomerBottomNav, CustomerOnboardingModal, CustomerPinGate, DescriptionSuggestions, FeedbackModal, MerchantOnboardingModal, NetworkStatus, OtherRolePrompt, PendingApprovalModal, PullToRefresh, PWAInstallBanner, QRCode, QuickAddCustomer, ReferModal, RoleSwitcher, ServiceWorkerRegistrar, SessionGuard, SessionHeartbeat, SmsReminderModal, SyncStatus, ThemeSwitcher, Toast, TransactionIcon, VersionGuard

---

## 4. Environment Variables

| Variable | Required |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes |
| `SESSION_HMAC_SECRET` | No (falls back to SUPABASE_SERVICE_ROLE_KEY) |
| `AAKASH_SMS_TOKEN` | No |
| `ESEWA_PRODUCT_CODE` | No (default: EPAYTEST) |
| `ESEWA_SECRET_KEY` | No |
| `NEXT_PUBLIC_SITE_URL` | No |
| `COOKIE_DOMAIN` | No |

---

## 5. Deployment

- [x] Supabase project configured
- [x] 46 migrations applied
- [x] Supabase Auth wired (phone OTP)
- [x] Custom session cookie system
- [x] PWA with service worker
- [x] CSV/JSON export
- [x] SMS integration (Aakash)
- [x] eSewa payment integration (UAT)
- [x] Deployed on Vercel
- [ ] Move eSewa from UAT to production
- [ ] Vercel preview deployments for PRs

---

*Report generated July 21, 2026*
