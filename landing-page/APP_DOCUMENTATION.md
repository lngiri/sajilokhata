# QR Hisab (सजिलो खाता) — Application Documentation

This document describes the actual shipped product: what it does, who uses it, how it
works, and how it is built. It is the single source of truth for every other document in
this package.

---

## 1. What it is

**QR Hisab** (project name **SajiloKhata**) is a digital credit ledger ("khata") for
small Nepali shops. Shop owners record what customers owe them, and customers pay or
verify what they owe — all from a phone, with no app download required for customers.

**One-liner (from `package.json`):**
> "Nepali shopko lagi digital credit ledger. Mobile-first PWA built with Next.js 16."

**Landing hero copy (already written, reuse it):**
> H1: "Your entire business in one digital khata"
> Eyebrow: "Made for Nepali shop owners & traders"
> Subhead: "Track customer credits, manage shop-to-shop purchases, record expenses — all
> from your phone. One app for every rupee your business touches."

---

## 2. Core concepts

- **Khata** — the traditional ledger of credit purchases. A shop sells on credit, notes it
  in a book ("khata"), and collects later. QR Hisab digitizes this book.
- **Merchant** — a shop owner/trader who runs a shop (kirana, pharmacy, hardware, etc.).
- **Customer** — a person who buys from the merchant, often on credit.
- **Both roles** — the same phone number can act as merchant and customer.
- **Credit log** — a single transaction/entry (debit or credit) between a merchant and a
  customer.
- **Credit limit** — an optional per-customer cap on outstanding credit.
- **M2M (shop-to-shop)** — a merchant buying on credit from another merchant.

---

## 3. Roles and access

Registration is via **phone number + OTP** (SMS via Aakash SMS), then a **4–6 digit PIN**
is set. Sessions are signed **HMAC cookies** (cookie `session`, 30-day default). There is
no traditional email/password.

### 3.1 Merchant
- Sets up shop profile (name, business type, display name, location).
- Generates a **QR code** customers scan to find the shop.
- Records credit/debit entries, manages products, prints the shop QR.
- Runs a **live dashboard** (realtime) with sales, credit given, collections.
- Sends **SMS reminders** to customers (paid credits; see §7 monetization).
- Sets **credit limits**, flags problem customers, resolves disputes.
- Imports data from CSV; exports/backs up; uses **offline mode**.

### 3.2 Customer
- Scans a merchant's QR code (camera or uploaded image).
- Sees their **balance with that merchant** and full purchase history.
- Requests credit, or makes a payment to be approved by the merchant.
- Can also scan a **reverse QR** (merchant shows it) for offline/quick access.
- No app install required; runs in the browser (PWA).
- Keeps an account with a **customer HMAC session** in `localStorage`.

### 3.3 Both
- Same phone number can be merchant of one shop and customer of another (or of their own
  shop — shop-to-shop).
- An in-app **role switcher** / **"Other role" prompt** lets the user flip between views.

### 3.4 Admin (platform team)
- Self-service admin panel: dashboard, alerts, disputes, users, sessions, SMS requests,
  analytics, storage, health checks, announcements, branding, CMS.
- Session monitoring: see live user sessions (device info, IP) and force-logout devices.

---

## 4. Core user flows

### 4.1 Merchant onboarding
1. Sign up with phone + OTP.
2. Set a 4–6 digit PIN.
3. Complete shop setup (name, business type, location).
4. Land on dashboard → print/display the shop QR code.
5. Add products (optional) and invite customers.

### 4.2 Customer transaction (the primary loop)
1. Customer scans the merchant's QR (camera scan in-app, or browser).
2. They land on a page showing the merchant and their balance.
3. They enter the **amount** and optional **description**.
4. They choose **credit** (I owe) or **payment** (I pay).
5. Confirmation:
   - Credit → "Credit request sent! Awaiting merchant approval."
   - Payment → "Payment submitted! Awaiting merchant confirmation."
6. Merchant sees the request in real time and **approves or rejects** it.
7. Both sides see the updated balance instantly.

### 4.3 Entry statuses
Every credit log has a status:

| Status | Meaning |
|---|---|
| `awaiting_confirmation` | Submitted, not yet acted on (customer-entered or merchant-entered) |
| `approved` | Accepted; balance updated |
| `rejected` | Declined; balance unchanged |

Merchant-entered entries may go straight to approved or sit in `awaiting_confirmation`
for customer acknowledgement. `initiated_by` records who created the entry.

### 4.4 Disputes / edit requests
- A customer can request an **edit/dispute** on an entry they believe is wrong.
- The merchant reviews and accepts or rejects the correction (audit trail preserved).

### 4.5 Offline mode
- Service worker caches the app (`qrhisab-v8`); entries are staged in IndexedDB
  ("QR Hisab" v3 stores) and **synced when the network returns**.
- A **reverse QR** flow lets a merchant display their QR for offline/quick customer access.

### 4.6 Bill parsing (beta/featured)
- Camera a bill/paper, and a **Gemini 2.5 Flash** model parses it into a structured entry.
- Rate-limited: `MAX_DAILY_PARSES = 50` per account per day.

---

## 5. Feature inventory (summary — see `FEATURES.md`)

- Digital khata with live dashboard (realtime Supabase subscriptions).
- QR scan access (no customer app download), incl. reverse QR.
- Products catalog with prices (`default_rate`) and units.
- Customer management: balances, credit limits, flags/warnings, defaulter lists.
- Shop-to-shop (M2M) purchase requests between merchants.
- SMS payment reminders (Aakash SMS; rate-limited).
- eSewa (UAT) bill payments; payment methods incl. FonePay, Khalti, eSewa, NepalPay,
  bank deposit, cash; voucher handling.
- Audit trail, CSV import, notifications (realtime + SMS), offline sync, onboarding tour.
- Admin panel with analytics and session monitoring.

---

## 6. Architecture

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Styling | Tailwind CSS v4 (CSS-first config) |
| Language | TypeScript |
| Database | Supabase Postgres (+ PostGIS) |
| Auth/session | Custom HMAC-signed cookies + bcrypt PINs (no OAuth) |
| Realtime | Supabase Realtime (dashboard subscriptions) |
| Offline | Service worker + IndexedDB |
| SMS | Aakash SMS (`sms.aakashsms.com`) |
| Payments | eSewa UAT (test mode) |
| AI | Gemini 2.5 Flash (bill parsing) |
| Tests | Vitest (unit), Playwright (E2E) |
| Hosting | Vercel |
| Deployment | Branch previews + production (prod domain `app.qrhisab.com`, aliased `qrhisab.com`) |

### 6.1 Key implementation files
- `src/middleware.ts` — session-cookie validation on protected routes.
- `src/lib/session.ts` — HMAC session signing (`SESSION_COOKIE = "session"`, 30d).
- `src/lib/supabase/admin.ts` — admin service-role client.
- `src/app/actions/pin.ts` — PIN set/login/register.
- `src/app/actions/customer.ts` — `resolveAuthenticatedCustomer`, `submitCustomerEntry`.
- `src/app/actions/merchant.ts`, `products.ts`, `otp.ts`, `sms.ts`, `sms-billing.ts`,
  `notifications.ts`.
- `src/app/api/ai/parse-bill/route.ts` — Gemini bill parsing.
- `src/app/api/*` — session, verify/approve, auth/bypass, merchant/setup, health routes.
- `supabase/migrations/001–056, 099` — schema (note: no migrations 020 or 050–052).

### 6.2 Security posture
- HMAC-signed session cookies (no JWT).
- bcrypt-hashed PINs.
- Row Level Security (RLS) on tables.
- Rate limiting on SMS/OTP and AI parse.
- `vercel.json` security headers: `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy: camera=()`.
- Idempotency keys and `sync_status` on credit logs (offline sync safety).
- No analytics/GA/Sentry found in the codebase.

---

## 7. Monetization (as currently implemented)

- **Free** to sign up, create a shop, record entries, use the dashboard.
- **SMS credits** are the monetized feature:
  - Package sizes in code: **Rs 101 / Rs 201 / Rs 501**.
  - SMS allowance: **50 / 110 / 300** SMS respectively.
  - Purchased via eSewa (UAT payment gateway) — or bank (manual).
- SMS is used for customer payment reminders and OTPs.

---

## 8. Versions

| Field | Value | Source |
|---|---|---|
| `package.json` name/version | `qrhisab` **v1.0.0** | `package.json` |
| `APP_VERSION` constant | **v1.1.0** | `src/` |
| About/help screen | **v1.0.0** (may lag) | app UI |

**Note:** version strings are inconsistent across the app (1.0.0 vs 1.1.0). Decide one
canonical version before marketing uses one.

---

## 9. Environment & deployment

- Prod domain: `app.qrhisab.com` (also aliased from `qrhisab.com`).
- Deploys via Vercel; branch previews auto-deploy.
- Env vars: `SESSION_HMAC_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AAKASH_SMS_TOKEN`,
  Gemini keys, `MAX_DAILY_PARSES`.
- The landing/marketing site can share this repo or live as a separate route — see
  `BUILD_INSTRUCTIONS.md`.

---

## 10. Facts verified vs not

- **Verified in code:** every feature listed above, the status enums, the SMS packages,
  the version strings, the hero copy, the security headers.
- **Not verified (`UNKNOWN`):** real user counts, real testimonials, real revenue/credit
  volume, SMS gateway production token, eSewa production keys, analytics. All of these are
  placeholder or absent in the code. See `MISSING_INFORMATION.md`.
