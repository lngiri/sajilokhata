# TODO List

Legend: `[ ]` pending · `[~]` in progress · `[x]` done

---

## 🎯 Recently Completed (July 2026)

- [x] **Aakash SMS API Integration** — Fully working transaction messages via `https://sms.aakashsms.com/sms/v3/send` with OTP + payment reminders + onboarding.
- [x] **SMS Balance Guard / Interceptor** — `sendTransactionSMS` checks merchant's `sms_balance` before hitting Aakash API; returns `INSUFFICIENT_SMS_CREDIT` error if <= 0; atomically decrements by 1 on success via `decrement_sms_balance` RPC.
- [x] **eSewa Web Checkout Integration** — HMAC-SHA256 backend signature verification, UAT environment (`https://uat.esewa.com.np/epay/main`), 3 pricing packages (101/50, 201/110, 501/300), `sms_recharge_logs` table for auditable transaction trail, `increment_sms_balance` RPC for atomic credit addition.
- [x] **Billing Page (`/merchant/billing`)** — Plan cards with "Buy Now" auto-submit hidden form to eSewa, low-balance warning banner, recharge history table.
- [x] **eSewa Callback Route (`/api/merchant/billing/callback`)** — POST handler decodes Base64 response, verifies signature, checks idempotency (`esewa_ref_id` + `transaction_uuid` dedup), updates log + balance.
- [x] **Success/Failure UI (`/merchant/billing/success`)** — Confirmation card with SMS count or error message.
- [x] **Onboarding Silent Failure Fix** — Replaced `.catch(() => {})` with proper async/await, loading spinner + "Sending OTP..." state, explicit error banners on failure.
- [x] **Resend OTP with 30s Cooldown** — Resend button with countdown timer, disabled state during cooldown, green "OTP resent!" message auto-clears after 4s.
- [x] **Change Phone Fallback** — "Change phone" link on OTP screen returns to phone input step, clears all OTP/resend state.
- [x] **Admin Force Logout Kill-Switch** — Token format upgraded to `userId.iat.expiresAt.sig`; middleware and `/api/auth/session` compare `iat` against `merchant.force_logout_at` DB field to revoke compromised sessions.
- [x] **Dashboard Business Name Prompt** — Banner on `/merchant/dashboard` alerts merchants using placeholder "Shop" to update their profile; links to `/merchant/settings`.
- [x] **Receive Payments Toggle State Guard** — `canToggleMethod()` validates required fields (QR URL for eSewa/Khalti/Fonepay/NepalPay; account holder + number for bank deposit) before enabling toggles.
- [x] **Onboarding SMS Optimization & Centralization** — Messages reduced to <150 chars English format; `sendOnboardingSMS` centralized inside `addCustomerForMerchant`; duplicate calls removed from `QuickAddCustomer.tsx` and `scan/page.tsx`.

## Auth & Sessions

- [x] Fix `setPin()` creates session cookie (was missing — caused redirect loop after PIN setup)
- [x] Add console logging at every auth transition (phone → OTP → PIN → set_pin → dashboard)
- [x] Fix login localStorage keys (`merchant_id`/`merchant_phone`) for all PIN flows
- [x] Verify full auth flow end-to-end in production (phone → OTP → PIN → dashboard)
- [x] Verify returning-user flow (phone → PIN → dashboard)
- [ ] Check `SessionGuard.tsx` doesn't conflict with middleware — may cause double-redirect
- [x] Implement `force_logout_at` kill-switch with iat-based token validation
- [ ] Test `force_logout_at` kill-switch from admin panel
- [x] Fix Forgot PIN redirect: now returns type-aware URL (merchant/customer/select-role) instead of hardcoded `/merchant/dashboard`

## Merchant Dashboard

- [x] Profile prompt: merchant created with name="Shop" — dashboard prompts to set real name
- [ ] Verify `getCurrentMerchantId()` works after PIN-set redirect (reads `merchant_id` from localStorage)
- [ ] Check `SyncStatus` component works with offline log queue
- [ ] Verify `SessionHeartbeat` actually refreshes the session cookie (periodic `/api/auth/session` call)

## Admin Panel

- [x] Create migration 022 (`022_ensure_admin_users.sql`) — idempotent, creates admins table + seeds `lngiri@gmail.com`
- [x] Create seed script (`scripts/seed-admin.ts`) — standalone Node.js runner
- [x] Fix admin signout redirect URL (was hardcoded to production URL, now uses localhost fallback for dev)
- [ ] Verify admin login → session → dashboard flow works end-to-end (needs DB access to test)
- [ ] Admin "sessions" page might need DB query adjustment for new schema
- [ ] Storage monitor — verify usage stats work with fresh DB
- [ ] User directory pagination — verify RPC function works with empty DB

## Customer Flow

- [x] Customer onboarding (`/onboard`) — OTP flow with resend + error handling now fully robust
- [ ] Customer PIN gate (`CustomerPinGate.tsx`) — verify SHA-256 PIN verification works
- [ ] Customer session cookie (`customer_session`) — verify middleware redirects correctly
- [ ] QR scan → entry creation flow — test with fresh merchant + customer

## Feedback & Support

- [~] Formspree form `xjkyqkwd` — need to verify email + configure domain in Formspree dashboard
- [ ] Add success toast after feedback sent (currently just shows "Thank you!" in modal)
- [ ] Refer modal — test Web Share API fallback for unsupported browsers

## PWA / Service Worker

- [x] Fix SW `TypeError: Failed to convert value to Response` — added `/` fallback to all catch blocks
- [x] Bypass auth routes in SW (`/login`, `/api/auth/*`) — no caching
- [x] Force clear caches + unregister old SW on version bump (`v3` → `v4`)
- [ ] Test PWA install prompt (`PWAInstallBanner.tsx`) works on mobile
- [ ] Test offline credit log creation syncs when back online

## Testing & Quality

- [ ] Add Vitest tests for auth flow (otp.ts, pin.ts, session.ts)
- [ ] Add Vitest tests for middleware (proxy.ts) — public routes, auth guards, role checks
- [ ] Add Vitest tests for phone normalization
- [ ] Run `npm test` — fix any existing test failures

## Infrastructure

- [ ] Set up Vercel preview deployments for PRs
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel environment variables
- [ ] Set up automatic migration runs on deploy
- [ ] Configure Formspree allowed domains (add production domain)

## 🔮 Future Features / Backlog

- [ ] **Move eSewa from UAT to production** — Replace `EPAYTEST` + `8g8M8maxQPm86ksx` with live product code and secret once corporate merchant status is approved.
- [ ] **Advanced analytics hooks** — B2B ledger micro-loans, merchant data analysis dashboards.
- [ ] **Targeted advertising** — Distributor placement components inside merchant dashboard.
- [ ] Email notifications for transaction summaries
- [ ] Multi-language support (Nepali + English)
- [ ] Barcode/QR-based inventory management
- [ ] Export to accounting software (QuickBooks, Tally)
