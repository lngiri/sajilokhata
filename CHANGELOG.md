# Changelog

All notable changes to SajiloKhata (QR Hisab) are recorded here.

---

## [Unreleased]

### Added
- **Migration 025** (`025_add_merchant_photo_url.sql`): Adds `photo_url TEXT` column to merchants table for profile photo support.
- **Photo upload endpoint** (`POST /api/merchant/upload-photo`): Stores profile photos in Supabase Storage `app_assets` bucket.
- **Photo upload UI**: Camera/gallery file picker + preview in merchant settings page.
- **Draggable ActionHub**: The blue "+" FAB can now be dragged anywhere on the screen (Messenger-style chat head). Turns red when menu is open. Uses pointer events for smooth drag.
- **ActionHub close/dismiss**: Menu closes on backdrop tap. FAB shows X icon when open for explicit close.

### Changed
- **Dashboard header**: Shop name is now the primary heading with business name/type and address shown as subtitle. App branding ("SK") is minimal — just a small icon badge.
- **SyncStatus compact view**: Now shows only a colored dot (green/amber/red/blue) without text labels. Tap to expand for full sync details.
- **Manual entry cash default**: When entering manual mode from "Record Cash Sales", the Cash Sale tab is now pre-selected.
- **ActionHub menu positioning**: Menu opens above or below the FAB depending on vertical position to stay within viewport.

### Fixed
- **Login localStorage**: `merchant_id` and `merchant_phone` now saved before redirect in all PIN flows (`handlePinSubmit`, `handleSetPin`, `handleSkipPin`, `handleForgotOtpSubmit`), fixing "+" button, QR scan, and phone-in-settings issues.
- **"Not logged in" on save**: Root cause was `getCurrentMerchantId()` returning null because `merchant_id` wasn't set in localStorage on PIN login.
- **Role selection UI**: New `select_role` step in login flow between OTP and PIN. New users choose Merchant or Customer; existing multi-role users choose which role to log in as.
- **`registerNewUser(phone, role)` action**: Creates merchant or customer row, sets session cookie, records session. Replaces auto-creation that was inside `verifyRegistrationOtp`.
- **`scripts/audit-ghost-users.ts`**: Read-only audit to find incomplete registrations (`pin_hash IS NULL`). Run with `--delete` to clean up.
- **`scripts/wipe-all-users.ts`**: Wipes all user data (merchants, customers, sessions, logs) for a fresh start.

### Changed
- **`verifyRegistrationOtp`**: No longer creates user rows or sets session cookies. Only verifies OTP and returns existence info (`{ exists, hasPin, userId, userType }`). Caller must use `registerNewUser()` after role selection.
- **Login flow**: OTP → role selection → account creation (`registerNewUser`) → PIN setup. No more auto-assumed "merchant" role.
- **Onboard page**: Uses `registerNewUser(phone, 'customer')` for new customers instead of relying on `verifyRegistrationOtp` to create a merchant.
- **Middleware logging** (`proxy.ts`): Logs `verifySessionToken()` result, `supabase.auth.getUser()` result, DB role lookup outcome, and final middleware action per request.
- **SessionGuard retry**: Non-force-logout mismatches retry `/api/auth/session` after 2s before wiping.
- **Session API logging** (`/api/auth/session`): Logs cookie presence, HMAC verify result, DB lookup result, and specific reason for `userId: null`.
- **Auth action verification**: `registerNewUser`, `loginWithPin`, and `setPin` read back the cookie after setting to confirm it was written.
- **HMAC key resolution** (`session.ts`, `admin-session.ts`): Priority chain `SESSION_HMAC_SECRET → SUPABASE_SERVICE_ROLE_KEY → fallback`, with console log showing which source is used.
- **`next.config.ts` `env`** bridges `SUPABASE_SERVICE_ROLE_KEY` → `SESSION_HMAC_SECRET` so both Edge and Node.js runtimes use the same HMAC key.

### Fixed
- **Redirect loop (root cause)**: `verifySessionToken` in middleware (Edge Runtime) was using fallback `"session-secret-fallback"` while `createSessionToken` in server actions (Node.js) used the real `SUPABASE_SERVICE_ROLE_KEY`. Every cookie created by a server action was rejected by the middleware → immediate redirect to `/login`. Fix: `SESSION_HMAC_SECRET` is now bridged via `next.config.ts` `env` (available in ALL runtimes), and `getHmacKey()` logs which key source is used.
- Role-based routing: `verifyRegistrationOtp` no longer auto-creates merchants — new users register with their chosen role.
- Auth flow: `setPin()` now creates a session cookie (was missing, causing redirect to phone after PIN setup).
- Auth flow: `handleSetPin` gracefully redirects to phone step if `userInfoRef` is missing.
- Admin signout redirect: Changed `https://www.qrhisab.com` to `http://localhost:3000` fallback.
- Auth signout redirect: Relative dev fallback instead of hardcoded production URL.
- Forgot PIN flow: `forgotPinVerifyOtp` validates `exists` before proceeding, returns `redirect` URL based on `verified.userType`.
- Admin session module (`admin-session.ts`) also uses `SESSION_HMAC_SECRET` for HMAC consistency.

---

## [2026-07-15]

### Fixed
- **Redirect loop** (`ERR_TOO_MANY_REDIRECTS`): Public routes (`/login`, `/scan`, `/onboard`, `/delivery`, `/verify`, `/select-role`, `/_not-found`) now bypass all auth processing in middleware
- **SW TypeError**: All SW fetch catch blocks return `caches.match("/")` as final fallback so `event.respondWith` always gets a valid `Response`
- **Auth route caching**: SW bypasses `/login` and `/api/auth/*` entirely
- **SW cache-bust**: `ServiceWorkerRegistrar.tsx` force-clears all caches and unregisters old workers on version bump (`v3` → `v4`)

### Changed
- Removed dead `/login` + `/` redirect block from `proxy.ts` (now handled by public-route whitelist at top)

---

## [2026-07-14]

### Fixed
- **Feedback form**: Added `formspree.io` to SW bypass list; added HTTP status + body logging to catch block

---

## [2026-07-12] — Production Reset

### Changed
- **Migration 021** (`production_reset.sql`): Wiped all user data for fresh production deploy
- Reverted database to clean schema-only state

---

## [2026-07-10] — Auth Rewrite

### Added
- **PIN + OTP hybrid auth**: Phone → OTP → PIN setup → dashboard flow
- **bcrypt PIN hashing**: 10-round bcrypt for all merchant/customer PINs
- **Role-based routing**: `/select-role` for dual-role users, auto-detect single-role
- **Session monitor rewrite**: Queries both merchants + customers tables, records sessions with device info + IP
- **`force_logout_at`** kill-switch: Admins can force-terminate all sessions for a merchant

### Fixed
- Auth guard in middleware now protects `/merchant/*` and `/delivery/*` based on role

---

## [2026-07-09]

### Added
- **Admin panel features**: Dynamic directory, brand upload (logo + favicon), merchant detail page
- **Admin dashboard**: Dark theme redesign with stats, alerts, sessions, announcements, CMS, branding, health, storage, disputes

### Fixed
- Admin panel data binding, interactive directory, branding upload, detail page stability
- Admin panel no longer constrained to mobile width on desktop

---

## [2026-07-08]

### Added
- **Floating Action Hub** (`ActionHub.tsx`): Home, Support (email), Refer (Web Share API), Feedback (Formspree)
- **Theme toggle** (`ThemeSwitcher.tsx`): Light/dark mode with `next-themes`
- **Pull-to-refresh** (`PullToRefresh.tsx`): Mobile-friendly refresh on dashboard

### Fixed
- Admin directory: RPC function `get_user_directory_safe` renamed to avoid `status` column dependency
- `getAdminUserDirectory`: RPC-first with JS fallback approach
- `getAdminMerchantDetail`: Resilient individual count queries

---

## [2026-07-07]

### Added
- **Phone normalization + dedup**: `normalizePhone()` strips `+977`, leading `0`, non-digits — deduplicates directory rows
- **Customer PIN reset**: Merchant-led PIN reset from customer detail page
- **Customer PIN auth**: SHA-256 based (simpler than bcrypt, for less sensitive customer flow)
- **Set-PIN prompt**: Customers without PIN are prompted to set one

---

## [2026-07-06]

### Fixed
- **"Not logged in" on every merchant page**: Replaced all client-side Supabase queries with server actions using admin client (service-role bypasses RLS)
- **Logged-in users on `/` or `/login`**: Now redirect to correct dashboard
- **QR scanner**: Camera no longer auto-starts; X button navigates to dashboard
- **Admin layout width**: Removed `max-w-7xl` constraint from admin main content

### Added
- **Landing page** (`/`): Professional marketing page with framer-motion scroll-reveal animations
- **Session heartbeat**: Periodic session cookie refresh to prevent mid-day logouts
- **"Remember Me"**: Session TTL option (1 hour vs 30 days)
- **Force logout**: Admin can force-terminate merchant sessions

---

## [2026-07-05] — Initial Production Build

### Added
- Full merchant dashboard with credit ledger, customer management, QR generation
- Customer scan flow with offline support (IndexedDB pending logs)
- Delivery diary with photo proof
- PWA support with service worker + manifest
- CSV/JSON export engine
- Toast notification system
- Supabase phone OTP auth
- 20 database migrations covering schema, RLS, triggers, indices, views
- Admin panel with user management, alerts, analytics, announcements

### Fixed
- Replaced all `alert()` calls with Toast component
- Wired real Supabase auth (removed `DEMO_MERCHANT_ID`)
- Real CSV/JSON export (removed mock setTimeout)
