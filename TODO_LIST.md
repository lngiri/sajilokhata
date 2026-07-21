# TODO List

Legend: `[ ]` pending · `[~]` in progress · `[x]` done

---

## Recently Completed

- [x] **OtherRolePrompt add-role flow** — Component navigates to `/login?addRole=<role>` for registering second role. Login page detects parameter, pre-fills phone, routes through OTP → registerNewUser → set PIN.
- [x] **Shared userId architecture** — `registerNewUser()` reuses existing UUID when adding second role. Dual-role users share same ID across merchants + customers tables.
- [x] **Post sign-out quick re-login** — `signOut()` saves `{ phone, isDualRole }` to `localStorage("qr_hisab_last_session")`. Login page shows role selection for dual-role users or pre-fills phone for single-role users.
- [x] **Add-role duplicate guard fix** — `registerNewUser()` no longer blocks adding second role. Only blocks if target role already exists.
- [x] **Role selection rendering fix** — `handlePhoneSubmit` sets `availableRoles` to `["merchant", "customer"]` instead of `["both"]`.
- [x] **Role selection userInfoRef fix** — Multi-role login path now sets `userInfoRef` to prevent "Session expired" on role selection.
- [x] **Network error after browser Back** — Removed `startTransition` wrapping async server actions, added `mountedRef` guard + `pageshow` listener.
- [x] **Aakash SMS API Integration** — Transaction messages via `https://sms.aakashsms.com/sms/v3/send` with OTP + payment reminders + onboarding.
- [x] **SMS Balance Guard** — `sendTransactionSMS` checks `sms_balance` before hitting Aakash API; atomically decrements via `decrement_sms_balance` RPC.
- [x] **eSewa Web Checkout** — HMAC-SHA256 backend signature, UAT environment, 3 pricing packages, `sms_recharge_logs` audit trail.
- [x] **PIN + OTP hybrid auth** — Phone → OTP → PIN setup → dashboard flow with bcrypt hashing.
- [x] **Role-based routing** — `/select-role` for dual-role users, auto-detect single role.
- [x] **Session monitor** — Queries both merchants + customers tables, records sessions with device info + IP.
- [x] **Force logout kill-switch** — Admin sets `force_logout_at` timestamp, middleware compares against token `iat`.
- [x] **Onboarding gates** — `useRef` short-circuit guards prevent infinite render loops on merchant/customer dashboard and verify page.

## Auth & Sessions

- [x] Fix `setPin()` creates session cookie (was missing — caused redirect loop after PIN setup)
- [x] Add console logging at every auth transition (phone → OTP → PIN → set_pin → dashboard)
- [x] Fix login localStorage keys (`merchant_id`/`merchant_phone`) for all PIN flows
- [x] Verify full auth flow end-to-end in production (phone → OTP → PIN → dashboard)
- [x] Verify returning-user flow (phone → PIN → dashboard)
- [ ] Check `SessionGuard.tsx` doesn't conflict with middleware — may cause double-redirect
- [x] Implement `force_logout_at` kill-switch with iat-based token validation
- [ ] Test `force_logout_at` kill-switch from admin panel
- [x] Fix Forgot PIN redirect: now returns type-aware URL (merchant/customer/select-role)

## Merchant Dashboard

- [x] Profile prompt: merchant created with name="Shop" — dashboard prompts to set real name
- [ ] Verify `getCurrentMerchantId()` works after PIN-set redirect (reads `merchant_id` from localStorage)
- [ ] Check `SyncStatus` component works with offline log queue
- [ ] Verify `SessionHeartbeat` actually refreshes the session cookie

## Admin Panel

- [x] Create migration 022 (`022_ensure_admin_users.sql`) — creates admins table + seeds admin
- [x] Fix admin signout redirect URL (was hardcoded to production URL, now uses localhost fallback)
- [ ] Verify admin login → session → dashboard flow works end-to-end

## Customer Flow

- [x] Customer onboarding (`/onboard`) — OTP flow with resend + error handling
- [ ] Customer PIN gate (`CustomerPinGate.tsx`) — verify SHA-256 PIN verification works
- [ ] Customer session cookie (`customer_session`) — verify middleware redirects correctly
- [ ] QR scan → entry creation flow — test with fresh merchant + customer

## PWA / Service Worker

- [x] Fix SW `TypeError` — added `/` fallback to all catch blocks
- [x] Bypass auth routes in SW (`/login`, `/api/auth/*`)
- [x] Force clear caches + unregister old SW on version bump
- [ ] Test PWA install prompt (`PWAInstallBanner.tsx`) works on mobile
- [ ] Test offline credit log creation syncs when back online

## Testing & Quality

- [ ] Add Vitest tests for auth flow (otp.ts, pin.ts, session.ts)
- [ ] Add Vitest tests for middleware (middleware.ts)
- [ ] Add Vitest tests for phone normalization
- [ ] Run `npm test` — fix any existing test failures

## Infrastructure

- [ ] Set up Vercel preview deployments for PRs
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel environment variables
- [ ] Configure Formspree allowed domains (add production domain)

## Future Features / Backlog

- [ ] **Move eSewa from UAT to production** — Replace test credentials with live product code and secret.
- [ ] **Advanced analytics hooks** — B2B ledger micro-loans, merchant data analysis dashboards.
- [ ] **Targeted advertising** — Distributor placement components inside merchant dashboard.
- [ ] Email notifications for transaction summaries
- [ ] Multi-language support (Nepali + English)
- [ ] Barcode/QR-based inventory management
- [ ] Export to accounting software (QuickBooks, Tally)
