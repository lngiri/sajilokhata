# QR Hisab — Copywriting Guide

Rules, headlines, buttons, and microcopy for the landing page. All claims are backed by
`FEATURES.md`; placeholders are flagged.

---

## 1. Tone

Simple. Friendly. Local. Confident but not hypey. Imagine talking to a busy shop owner
across the counter, in Nepali-flavored English.

## 2. The hero

- **Eyebrow:** "Made for Nepali shop owners & traders"
- **H1:** "Your entire business in one digital khata"
- **Subhead:** "Track customer credits, manage shop-to-shop purchases, record expenses —
  all from your phone. One app for every rupee your business touches."
- **Primary CTA:** "Start Free"
- **Secondary CTA:** "See How It Works"

## 3. Headline bank (per section)

| Section | Headline option A | Headline option B |
|---|---|---|
| How it works | "From scan to settled in four steps" | "How a credit entry actually works" |
| QR access | "Your customers don't need an app" | "Just scan the QR at your counter" |
| Dashboard | "See who owes what, in realtime" | "Your whole khata, live on your phone" |
| Reminders | "Get paid — politely" | "Polite SMS reminders that actually collect" |
| Limits & flags | "Give credit with confidence" | "Stop bad debt before it starts" |
| Shop-to-shop | "One app for buying and selling on credit" | "Your shop-to-shop khata, finally matching" |
| Offline | "Works even when the network doesn't" | "Your khata works in any signal" |
| Security | "Your khata stays yours" | "PIN-locked. Audited. Backed up." |
| Pricing | "Start free. Pay only if you want SMS." | "Free khata. Optional SMS credits." |
| Final CTA | "Start your digital khata today" | "Bring your khata into your phone" |

## 4. How-it-works (the four steps)

1. **Scan** — "Customer scans your shop QR. No install, no signup."
2. **Enter** — "They enter the amount — or pick a product and it fills itself."
3. **Confirm** — "You approve or reject in realtime. They see it instantly."
4. **Done** — "Balance updated. Both of you know exactly where you stand."

## 5. Feature tile copy (from `FEATURES.md`)

1. **QR access** — "Customers see their balance by scanning your QR. No app install."
2. **Live dashboard** — "See who owes what, in realtime, from your phone."
3. **Smart reminders** — "Send a polite SMS reminder and get paid faster."
4. **Credit limits & flags** — "Give credit with confidence. Stop bad debt."
5. **Shop-to-shop** — "One app for buying on credit and selling on credit."
6. **Offline khata** — "Works even where the network doesn't."

## 6. Pricing copy

- Framing: **"The khata is free. SMS reminders are optional."**
- Cards (code-verified): Rs 101 → 50 SMS · Rs 201 → 110 SMS · Rs 501 → 300 SMS.
- Footnote: "SMS credits send customer payment reminders. Pay by eSewa or bank.
  (Payments currently in test mode — `UNKNOWN` rollout status.)"

## 7. Microcopy / buttons

- "Start Free" (primary, everywhere).
- "See How It Works"
- "Print Your Shop QR"
- "Download the App" — avoid; it's a web PWA → use **"Add QR Hisab to your home screen"**.
- Toasts already in product (reuse in screenshots/captions):
  - "Credit request sent! Awaiting merchant approval."
  - "Payment submitted! Awaiting merchant confirmation."

## 8. Empty-state & error-tone

- Friendly, no blame. Product examples: "No products yet", "Add Your First Product".

## 9. Bilingual microcopy

- English primary; Nepali key phrases. Example from the app: "Scan garera credit
  rakhnus" ("scan and keep the credit"). Provide full नेपाली for hero + pricing.

## 10. Social proof (PLACEHOLDER — do not ship as real)

From landing code (verify current state): testimonial placeholders such as:

> "Ramesh S., Kirana store, Kathmandu" — kirana owner on recording credit faster.
> "Sita D., Pharmacy, Pokhara" — pharmacist on shop-to-shop and reminders.
> "Ram K., Hardware, Chitwan" — hardware trader on offline and limits.

**These are placeholders.** Replace with real, consent-given stories before launch
(`MISSING_INFORMATION.md`). If none exist, cut the testimonials section rather than
ship fake quotes.

## 11. Numbers & stats (use ONLY verified)

Hardcoded landing stats exist in code (e.g. "10,000+ happy shop owners",
"100,000+ entries tracked", "Rs 25Cr+ managed", "4.8/5"). **These have no analytics
backing in the repo — mark `UNKNOWN`/aspirational and do not display until confirmed.**

## 12. Final checklist per line of copy

- [ ] Backed by a feature in `FEATURES.md`?
- [ ] No invented numbers or quotes?
- [ ] Understandable to a busy shop owner?
- [ ] Correct rupee/Nepali formatting?
