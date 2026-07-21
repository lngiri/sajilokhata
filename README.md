# QR Hisab (सजिलो खाता)

Nepali shopko lagi digital credit ledger. Mobile-first PWA built with Next.js 16.

## Quick Start

```bash
npm install
cp .env.example .env.local   # fill in Supabase + eSewa + Aakash SMS keys
npm run dev                   # → http://localhost:3000
npm run build                 # production build
npm test                      # vitest
```

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router + Turbopack) |
| UI | React 19, Tailwind CSS 4 |
| Language | TypeScript 6 |
| Database | Supabase (PostgreSQL + PostGIS) |
| Auth | Custom HMAC-SHA256 session cookies + bcrypt PIN hashing |
| AI | Google Gemini 2.5 Flash (receipt/ledger parsing) |
| Offline | IndexedDB (idb) + Service Worker |
| Payments | eSewa (SMS credit recharge) |
| SMS | Aakash SMS API |
| Export | CSV (papaparse), Excel (xlsx) |
| Testing | Vitest + Testing Library + Playwright |
| Deploy | Vercel |

## Project Structure

```
src/
├── app/             # Next.js App Router pages + API routes + server actions
│   ├── actions/     # Server actions (otp, pin, merchant, admin, sms-billing, etc.)
│   ├── admin/       # Admin panel
│   ├── api/         # API route handlers (auth, merchant, sms, ai, billing)
│   ├── customer/    # Customer-facing pages (dashboard, history, settings)
│   ├── merchant/    # Merchant pages (dashboard, logs, customers, qr, billing, settings, scan, reports)
│   ├── login/       # Auth wizard (phone → OTP → PIN → dashboard)
│   └── ...
├── components/      # Shared React components (30 files)
├── lib/             # Utilities: auth, session, supabase clients, phone, rate-limit, SMS, offline
├── middleware.ts    # Route protection, session verification, role guard
docs/                # Product docs, DB schema, architecture
public/              # Static assets, service worker, PWA manifest
supabase/migrations/ # SQL migrations (46 files)
```

Full architecture breakdown → [`ARCHITECTURE.md`](ARCHITECTURE.md)

## Key Patterns

### Auth Flow

```
Phone → checkUserExists()
  ├─ New user → sendRegistrationOtp() → OTP verify → role select → registerNewUser() → set PIN → dashboard
  ├─ Existing user (single role) → PIN entry → loginWithPin() → set session cookie → dashboard
  ├─ Existing user (dual role) → role select → PIN entry → loginWithPin() → dashboard
  └─ Add role → /login?addRole=X → OTP verify → registerNewUser() (shared userId) → set PIN → dashboard
```

Two auth systems coexist:
1. **Custom session cookie** (primary): HMAC-SHA256 signed, 30-day TTL, force-logout support
2. **Supabase Auth** (legacy/fallback): used when custom session is absent

### Onboarding Gates (Preventing Re-Render Loops)

The app has three onboarding gates that check profile completeness and show a modal if data is missing. Each gate uses a **`useRef` short-circuit guard** to prevent infinite re-render loops:

```
Merchant Dashboard:   loadData() → if (!profileData.name || !address || !business_type) → MerchantOnboardingModal
Customer Dashboard:   useEffect → if (!profile.name || !address) → CustomerOnboardingModal
Verify Page:          useEffect → if (!customers.name || !customers.address) → CustomerOnboardingModal
```

**The guard pattern** (fixed after production crash):
```tsx
const onboardedRef = useRef(false);

useEffect(() => {
  if (onboardedRef.current) return;  // ← top-level short-circuit
  onboardedRef.current = true;       // ← set immediately, never re-runs
  // ... fetch profile, check completeness, show modal if needed
}, []);
```

**The completion callback** also never re-fetches from the server:
```tsx
const handleOnboardingComplete = useCallback(() => {
  onboardedRef.current = true;
  setShowOnboarding(false);
}, []);
```

### Role-Based Redirect

After auth, users are redirected based on their roles (returned by `/api/auth/session`):

```
merchant only → /merchant/dashboard
customer only → /customer/dashboard
both roles    → /select-role (user picks)
no role       → stay on current page
```

The landing page and login page show a brief loading overlay with the role name during redirect.

### Critical Anti-Patterns (Avoid These)

1. **Never re-fetch profile in `handleOnboardingComplete`** — app reads stale DB data → modal loops
2. **Never use `useEffect` without a useRef guard** when fetching data that can change during the session
3. **Never depend on server-reflected state in the same render cycle** after an update

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (admin client + HMAC fallback) |
| `SESSION_HMAC_SECRET` | No | Dedicated HMAC signing key (falls back to `SUPABASE_SERVICE_ROLE_KEY`) |
| `AAKASH_SMS_TOKEN` | No | SMS API token |
| `ESEWA_PRODUCT_CODE` | No | eSewa product code (default: EPAYTEST) |
| `ESEWA_SECRET_KEY` | No | eSewa HMAC secret |
| `NEXT_PUBLIC_SITE_URL` | No | Canonical site URL |
| `COOKIE_DOMAIN` | No | Cookie domain for cross-subdomain auth |

## Scripts

| Command | Action |
|---------|--------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm test` | Run vitest |
| `npm run test:watch` | Watch mode |
| `npx vercel deploy --prod` | Deploy to production |

## Deployment

Deployed on Vercel. Automatic on `main` branch push. Manual:

```bash
npx vercel deploy --prod --force  # skip build cache
```

The service worker caches static assets on install — force a clean deploy after SW changes.
