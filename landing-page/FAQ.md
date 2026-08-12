# QR Hisab — FAQ

Questions to answer on the landing page. All answers are code-verified except where
marked `UNKNOWN`. Keep answers short; expandable accordion on the page.

---

## Product basics

**What is QR Hisab?**
A digital khata (credit ledger) for Nepali shops. Record what customers owe you, manage
shop-to-shop purchases, and track expenses from your phone.

**Do customers need to download an app?**
No. They scan your shop QR with their phone camera (or the QR Hisab scanner) and open
their balance in the browser.

**Is it really free?**
Yes, the core khata is free. The only paid thing is optional SMS reminder credits.

## Getting started

**How do I sign up?**
Enter your phone number, verify with an SMS OTP, and set a 4–6 digit PIN. Then set up
your shop.

**How long does setup take?**
A few minutes. You can record your first entry the same day.

**How do I move my old paper khata in?**
Use CSV import to bring existing customer and entry data in (feature exists — exact
format `UNKNOWN`, see `MISSING_INFORMATION.md`).

## Using the app

**How does a credit entry work?**
Customer scans your QR → enters amount (or picks a product) → chooses credit or payment
→ you approve/reject in realtime → balances update on both sides.

**What statuses do entries have?**
`awaiting_confirmation`, `approved`, `rejected`. Whoever made the entry is recorded, so
there's always an audit trail.

**Can I stop someone who abuses credit?**
Yes — set a credit limit per customer, and use flags/warnings and a defaulter list.

**Can I buy on credit from another shop with this app?**
Yes. The same account can be a merchant and a customer, so shop-to-shop purchases stay in
one khata.

**Does it work without internet?**
Yes. The app is a PWA: it caches the app shell and stages entries offline, then syncs
when the network returns — idempotency keys stop double entries.

**Can I read a paper bill with my camera?**
Yes — the app can parse a photographed bill into a draft entry using AI, capped at 50
parses/day.

## Payments & reminders

**How do I remind a customer to pay?**
Send an SMS reminder from the dashboard. SMS uses credit from your package
(Rs 101 → 50 SMS, Rs 201 → 110 SMS, Rs 501 → 300 SMS).

**How do I buy SMS credits?**
In-app Billing via eSewa or bank. **Note:** the payment gateway is currently in UAT/test
mode — live rollout status `UNKNOWN`.

**Which payment methods can I record?**
FonePay, Khalti, eSewa, NepalPay, bank deposit, and cash — plus vouchers.

## Security & privacy

**Is my data safe?**
OTP login + your PIN, cryptographically signed sessions, and database-level access rules
(RLS) mean you only ever see your own khata.

**What if I lose my phone?**
Force-logout your device from another session (admin/session controls).

**Do you track me?**
No tracking/analytics scripts are bundled today. (Commit to keeping it that way; add a
privacy policy before launch.)

**Is my data end-to-end encrypted?**
No — it's protected in transit (HTTPS) and access-controlled, but not E2E encrypted.
Don't claim otherwise.

## Misc

**Which devices work?**
Any phone/tablet/computer browser — it's a web app you can add to your home screen.

**Who is QR Hisab for?**
Kirana stores, pharmacies, hardware, restaurants, wholesalers — any shop that sells on
credit.

**What's the app version?**
`UNKNOWN`/inconsistent (1.0.0 vs 1.1.0 in different places) — to be reconciled.
