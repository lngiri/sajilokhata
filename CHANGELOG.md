# Changelog

All notable changes to SajiloKhata (QR Hisab) are recorded here.

---

## [Unreleased]

### Added
- **Migration 022** (`022_ensure_admin_users.sql`): Idempotent migration that creates the `admins` table if missing, recreates RLS policy, and seeds `lngiri@gmail.com` as admin. Safe to run on any DB state.
- **Admin seed script** (`scripts/seed-admin.ts`): Standalone Node.js script that can be run via `npx tsx scripts/seed-admin.ts` to seed the admin user without running a full migration.
- **Living documentation**: `ARCHITECTURE.md`, `CHANGELOG.md`, `TODO_LIST.md` — documentation-first protocol established.

### Fixed
- Auth flow: `setPin()` now creates a session cookie (was missing, causing redirect to phone after PIN setup)
- Auth flow: `handleSetPin` gracefully redirects to phone step if `userInfoRef` is missing
- Admin signout redirect: Changed `https://www.qrhisab.com` to `http://localhost:3000` fallback so signout works in dev mode
- Auth signout redirect: Same fix — relative dev fallback instead of hardcoded production URL
- Forgot PIN flow: `forgotPinVerifyOtp` now returns `redirect` URL based on `verified.userType` instead of hardcoding `/merchant/dashboard`
- Forgot PIN flow: Login page `handleForgotOtpSubmit` uses the dynamic `redirect` URL from the server action
- Logging: Added `[Login]`, `[OTP]`, `[loginWithPin]`, `[setPin]`, `[forgotPinVerifyOtp]` console logs at every auth transition point

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
