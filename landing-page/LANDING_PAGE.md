# QR Hisab — Landing Page Specification

Complete spec to build the marketing website. Derived from the codebase and product
strategy. The actual site is NOT yet built — build per `BUILD_INSTRUCTIONS.md`.

---

## 1. Purpose

One page, one job: **turn a Nepali shop owner into a signed-up merchant.** Secondary:
convince customers that scanning a shop's QR is easy, and drive SMS-credit purchases.

## 2. Structure (top → bottom)

| # | Section | Purpose | Key copy |
|---|---|---|---|
| 1 | Top bar | Brand + nav + CTA | Logo "QR Hisab", links (How it works, Features, Pricing, FAQ), button **Start Free** |
| 2 | Hero | 5-second pitch | Eyebrow "Made for Nepali shop owners & traders"; H1 "Your entire business in one digital khata"; sub; CTAs **Start Free** + **See How It Works**; hero visual = phone mockup of merchant dashboard + a scan QR |
| 3 | Proof strip | Quick trust | Stats (use only real ones; see `MISSING_INFORMATION.md` for UNKNOWNs) |
| 4 | How it works | The 4-step loop | Scan → Enter → Confirm → Done (customer), and Merchant approves in realtime |
| 5 | Features | Capability + benefit | From `FEATURES.md`; 6 tiles (below) |
| 6 | Shop-to-shop | M2M story | "Buy from your wholesaler on credit. Sell to shops on credit. Same app." + role switcher visual |
| 7 | Offline | Reliability | "Works even offline" + PWA install note |
| 8 | Security | Trust | PIN + HMAC sessions + RLS + reminders (see `TRUST_AND_SECURITY.md`) |
| 9 | Pricing | Monetization | 3 packages Rs 101/201/501 → 50/110/300 SMS + "Free forever core" line |
| 10 | Testimonials | Social proof | **Placeholders only** (replace with real, consent-given stories) |
| 11 | FAQ | Objections | From `FAQ.md` |
| 12 | Final CTA | Convert | "Start your digital khata today" + **Start Free** |
| 13 | Footer | Links, contact, legal, language switch (EN/ने) | |

## 3. Feature tiles (6, one line each)

1. **QR access** — "Customers see their balance by scanning your QR. No app install."
2. **Live dashboard** — "See who owes what, in realtime, from your phone."
3. **Smart reminders** — "Send a polite SMS reminder and get paid faster."
4. **Credit limits & flags** — "Give credit with confidence. Stop bad debt."
5. **Shop-to-shop** — "One app for buying on credit and selling on credit."
6. **Offline khata** — "Works even where the network doesn't."

## 4. Hero visual

- Phone frame showing the **merchant dashboard** (balance cards, recent entries).
- Floating QR card next to it (labeled "Scan to pay").
- Keep it real screenshots (see `SCREENSHOT_GUIDE.md`), not illustrations, to build trust.

## 5. Mandatory elements

- **Language toggle** EN / नेपाली for key blocks (the app is bilingual).
- **"Start Free"** as the only primary CTA (SMS credits are the paid feature; don't
  confuse with pricing-first framing).
- Mobile-first layout (most traffic will be phones).
- Install-PWA hint ("Add QR Hisab to your home screen").
- Privacy/terms links (content `UNKNOWN` — see `MISSING_INFORMATION.md`).

## 6. Success metrics

- Primary: merchant signup rate from landing.
- Secondary: time-to-first-entry, SMS credit purchases, FAQ page exits (low = good).
