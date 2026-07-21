# Technical Specifications

## Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router + Turbopack) | 16 |
| UI | React, React DOM | 19 |
| Language | TypeScript | 6 |
| Styling | Tailwind CSS | 4 |
| Database | Supabase (PostgreSQL + PostGIS) | — |
| Auth | Custom HMAC-SHA256 session cookies + bcrypt PIN hashing | — |
| Offline | IndexedDB (`idb`) + Service Worker | — |
| AI | Google Generative AI (Gemini 2.5 Flash) | — |
| Payments | eSewa web checkout (HMAC-SHA256 signature verification) | — |
| SMS | Aakash SMS API | — |
| QR | `qrcode.react` (generation), `html5-qrcode` (scanning) | — |
| Charts | Recharts | 3 |
| Export | `papaparse` (CSV), `xlsx` (Excel) | — |
| Testing | Vitest + Testing Library + Playwright | — |
| Deploy | Vercel | — |

## Runtime Architecture

- **Server Actions** (`src/app/actions/`): Run in Node.js runtime. Handle auth, CRUD, SMS, payments.
- **Edge Middleware** (`src/middleware.ts`): Runs on Edge Runtime. Route protection, session verification, role guards.
- **API Routes** (`src/app/api/`): Run in Node.js runtime. Auth session endpoint, eSewa callbacks, AI parsing, admin APIs.
- **Client Components** (`src/components/`): Interactive UI with `"use client"` directive.

## Security

### Session Tokens
- HMAC-SHA256 signed, 4-part format: `userId.issuedAt.expiresAt.signature`
- 30-day TTL, HTTP-only, Secure, SameSite=Lax
- HMAC key: `SESSION_HMAC_SECRET` env var (bridged to Edge via `next.config.ts`)
- Verified by middleware on every non-public request and by `/api/auth/session`

### PIN Hashing
- bcrypt with 10 rounds for merchant and customer PINs
- 4-digit PINs, stored as `pin_hash` in both `merchants` and `customers` tables

### OTP Verification
- 6-digit code stored in HTTP-only cookies (`otp_code`, `otp_phone`), 5-minute TTL
- Sent via Aakash SMS API
- Used for registration and forgot-PIN flows

### Force Logout
- Admin sets `merchants.force_logout_at` timestamp
- Middleware and session API compare token `issuedAt` against this timestamp
- Revoked sessions redirect to `/login?forceLogout=1`

### Row Level Security (RLS)
- Enabled on core tables (merchants, customers, merchant_customers, credit_logs, audit_logs, sessions)
- Most write operations go through service-role client (bypasses RLS) or SECURITY DEFINER functions
- Client-side RLS policies restrict SELECT to own records where applicable

### Rate Limiting
- In-memory rate limiter (`src/lib/rate-limit.ts`) for API endpoints
- Database-backed `rate_limits` table for persistent limits (service-role only)

## Offline Architecture

- **Service Worker** (`public/sw.js`): Cache-first for static assets, network-first for navigations. Bypasses `/login` and `/api/auth/*`.
- **IndexedDB** (`src/lib/offline/db.ts`): Pending credit logs, credit log items, photo attachments stored with per-item sync status (`offline_pending` | `syncing` | `failed`).
- **Sync Queue** (`src/components/SyncStatus.tsx`): Processes one item at a time with 15-second timeout. Auto-starts on online status change.

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@supabase/ssr` | Supabase SSR client with cookie handling |
| `@supabase/supabase-js` | Supabase client |
| `bcryptjs` | PIN hashing |
| `framer-motion` | Animations (landing page) |
| `html5-qrcode` | Camera QR scanning |
| `idb` | IndexedDB wrapper |
| `next-themes` | Dark/light theme |
| `papaparse` | CSV parsing/generation |
| `pg` | Direct PostgreSQL client (server actions) |
| `qrcode.react` | QR code generation |
| `recharts` | Dashboard charts |
| `uuid` | UUID generation |
| `xlsx` | Excel import/export |
| `@google/generative-ai` | Gemini AI for receipt/ledger parsing |

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (HMAC secret + admin client) |
| `SESSION_HMAC_SECRET` | No | Dedicated HMAC key (falls back to `SUPABASE_SERVICE_ROLE_KEY`) |
| `AAKASH_SMS_TOKEN` | No | SMS API token |
| `ESEWA_PRODUCT_CODE` | No | eSewa product code (default: `EPAYTEST`) |
| `ESEWA_SECRET_KEY` | No | eSewa HMAC-SHA256 secret |
| `NEXT_PUBLIC_SITE_URL` | No | Canonical site URL for redirects |
| `COOKIE_DOMAIN` | No | Cookie domain for cross-subdomain auth |
