# QR Hisab — Feature Inventory (code-verified)

Every feature below is present in the codebase (actions, schema, UI, or API). Nothing here
is aspirational. Anything unverifiable is in `MISSING_INFORMATION.md`, not here.

**How to use:** pick copy for landing sections from these bullets. Tag each with the
customer benefit in `COPYWRITING.md`.

---

## 1. Core khata

- **Digital credit ledger** — record who owes what, in seconds. Replace the paper khata.
- **Debit & credit entries** — customer owes (debit) or pays (credit) with optional
  description and per-entry details.
- **Entry statuses** — `awaiting_confirmation`, `approved`, `rejected`; who initiated the
  entry is tracked (`initiated_by`).
- **Audit trail** — every entry is attributed (customer vs merchant), idempotency keys
  prevent double-entry, `sync_status` tracks offline sync.
- **Balance tracking** — merchant↔customer current balance and running history.
- **Credit limits** — optional per-customer cap on outstanding credit (`credit_limit`).
- **Flags, warnings & defaulter lists** — mark risky customers, warn before giving more
  credit, view defaulters at a glance.

## 2. QR access (no app download for customers)

- **Shop QR code** — each merchant gets a unique QR (`{ type:"merchant_scan", merchantId,
  merchantName, businessType, timestamp }`). Print it, paste it, display it.
- **Customer scans → instant shop page** — no install, no signup to view balance/history.
- **Reverse QR** — merchant shows their QR for quick/offline customer access.
- **QR print page** — "Shop QR Code" with bilingual step instructions
  ("Scan garera credit rakhnus").

## 3. Customer experience

- **Scan → enter → reverse → done** — a four-step transaction flow, mobile-first.
- **Balance per merchant** — customer sees exactly what they owe each shop.
- **History with filters** — search/filter past entries.
- **Submit credit or payment** — "Credit request sent! Awaiting merchant approval." /
  "Payment submitted! Awaiting merchant confirmation."
- **Dispute / edit requests** — ask the merchant to fix a wrong entry.
- **PIN-protected customer account** — customer session via HMAC-signed token
  (`sajilo_customer_session` in localStorage) so strangers on a shared phone can't see
  balances without the PIN.
- **Customer dashboard** — own credit summary across merchants (optional).

## 4. Merchant tools

- **Live dashboard** — realtime sales, credit given, collections, outstanding.
- **Products catalog** — products with price (`default_rate`), unit, sort order;
  empty states ("No products yet", "Add Your First Product").
- **Product picker** (optional, shipped) — pick a product on a customer transaction to
  pre-fill amount + description; "Custom" chip for manual amounts.
- **Customer management** — add, search, credit limits, flags.
- **Import (CSV)** — bring existing paper khata data in.
- **Notifications** — realtime + in-app; approve/reject requests instantly.
- **Onboarding tour** — guided first-run setup.
- **Reports / analytics / charts** — dashboards and per-customer views (admin-level
  analytics also exist in the admin panel).
- **Backup/export** — data export path (see `UNKNOWN` in `MISSING_INFORMATION.md` for
  exact format).

## 5. Shop-to-shop (M2M)

- **Purchase requests between merchants** — a merchant buys from another merchant on
  credit through the same QR flow; both sides keep their own ledger.

## 6. Payments & billing

- **eSewa UAT payments** — test-mode payment gateway integration for SMS credits and bills.
- **Payment methods recorded** — FonePay, Khalti, eSewa, NepalPay, bank deposit, cash.
- **Vouchers** — voucher/reference handling on entries.
- **SMS credits** (the paid product): Rs 101 → 50 SMS, Rs 201 → 110 SMS, Rs 501 → 300 SMS.

## 7. SMS & reminders

- **Payment reminders via SMS** (Aakash SMS gateway) — "remind customer X of Rs Y".
- **OTP login** via SMS with **rate limiting**.
- **SMS credit tracking** — remaining balance visible; purchase flow integrated.

## 8. Offline & reliability

- **PWA / installable** — mobile-first, add to home screen.
- **Service worker cache** (`qrhisab-v8`) — app shell works offline.
- **IndexedDB staging** ("QR Hisab" v3) — entries queued offline, synced on reconnect.
- **Idempotency + sync status** — no double-posting after flaky networks.

## 9. Admin platform (self-service)

- Admin dashboard, alerts, disputes, users, sessions, SMS requests, analytics, storage,
  health checks, announcements, branding, CMS.
- **Session monitoring** — live sessions with device info + IP; force logout per device.

## 10. AI

- **Bill parsing** — photograph a paper bill; Gemini 2.5 Flash extracts amount/details into
  a draft entry. Cap: `MAX_DAILY_PARSES = 50`/day.

---

## Feature → landing copy mapping (quick)

| Landing section idea | Back it with |
|---|---|
| "Replace the paper khata" | §1, §2 |
| "Customers don't need the app" | §2, §3 |
| "Shop-to-shop on credit" | §5 |
| "Get paid — politely" | §7 (SMS reminders) |
| "Works even offline" | §8 |
| "Your data stays safe" | `TRUST_AND_SECURITY.md` |
| "Start free" | §6 SMS credits = the only paid thing, and optional |
