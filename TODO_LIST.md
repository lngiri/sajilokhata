# TODO List

Legend: `[ ]` pending · `[~]` in progress · `[x]` done

---

## Auth & Sessions

- [x] Fix `setPin()` creates session cookie (was missing — caused redirect loop after PIN setup)
- [x] Add console logging at every auth transition (phone → OTP → PIN → set_pin → dashboard)
- [ ] Verify full auth flow end-to-end in production (phone → OTP → PIN → dashboard)
- [ ] Verify returning-user flow (phone → PIN → dashboard)
- [ ] Check `SessionGuard.tsx` doesn't conflict with middleware — may cause double-redirect
- [ ] Test `force_logout_at` kill-switch from admin panel
- [x] Fix Forgot PIN redirect: now returns type-aware URL (merchant/customer/select-role) instead of hardcoded `/merchant/dashboard`

## Merchant Dashboard

- [ ] Profile prompt: merchant created with name="Shop" — dashboard should prompt to set real name
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

- [ ] Customer PIN gate (`CustomerPinGate.tsx`) — verify SHA-256 PIN verification works
- [ ] Customer session cookie (`customer_session`) — verify middleware redirects correctly
- [ ] Customer onboarding (`/onboard`) — verify OTP flow creates customer record
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

## Future Features

- [ ] Email notifications for transaction summaries
- [ ] Multi-language support (Nepali + English)
- [ ] Barcode/QR-based inventory management
- [ ] Payment gateway integration (eSewa, Khalti)
- [ ] Export to accounting software (QuickBooks, Tally)
- [ ] Automated SMS reminders for due payments
