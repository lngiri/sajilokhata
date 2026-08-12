# QR Hisab — Screenshot Guide

Every image on the landing page must be a **real screenshot of the running app** — no
fake UI, no mockups presented as product. This guide lists exactly what to capture.

---

## 1. Preparation before capturing

- Use a **clean test merchant** (fresh shop, one or two demo customers, 3–5 realistic
  entries). Never show a real merchant's live data.
- Set the device to mobile viewport: **375×812** (iPhone X-ish) at 1× or 2×.
- Put the browser on **Desktop/Phone mode** as needed; QR prints are desktop-sized.
- Anonymize: no real phone numbers/names. Use Nepali-flavored demo data
  (e.g. "Manish Stores", customer "Hari", products "Patan Rice 25kg" Rs 1,300).
- Match the app theme/colors so screenshots look consistent.

## 2. Screenshot list (map to landing sections)

### Hero
- **Merchant dashboard** — balance cards (Total credit, Collected, Outstanding) + recent
  entries. (Primary hero visual.)

### How it works (customer flow)
1. **Customer scan page** — shop header (name, business type) + "Your balance".
2. **Enter amount** — amount + description + optional product picker chips
   ("Products (optional)" + product chips showing `Rs {price}`).
3. **Confirm** — submit button for credit vs payment; toast
   "Credit request sent! Awaiting merchant approval." / "Payment submitted! Awaiting
   merchant confirmation."

### Features
- **Live dashboard** — realtime list view.
- **Reminders** — SMS reminder compose (customer, amount, "Send reminder").
- **Credit limits & flags** — customer card with limit + flag badge.
- **Products** — product list; also empty state "No products yet" / "Add Your First
  Product".
- **Shop-to-shop** — the same user's screen in "Customer" role scanning a merchant QR.

### Shop QR / print
- **Shop QR print page** — "Shop QR Code" + bilingual steps ("Scan garera credit rakhnus").

### Offline / PWA
- **Install prompt** — "Add QR Hisab to your home screen".
- (Optional) **Offline banner** — "You're offline — entries will sync" if the app shows one.

### Security (if used)
- **PIN entry** — the 4–6 digit PIN screen.

### Pricing
- **SMS credit purchase** — billing screen with package cards
  (Rs 101/201/501 → 50/110/300 SMS).

## 3. Image specs

| Use | Size | Format | Notes |
|---|---|---|---|
| OG/social card | 1200×630 | PNG/JPG | Single composite, brand bg |
| Phone mockup | ~375×812 (2× = 750×1624) | PNG | Transparent optional |
| Feature tiles | 800×600 or 1:1 | PNG/WebP | Short crop |
| QR code | ≥ 600×600 px | PNG | White bg, quiet zone |
| Favicon/icon | from `public/` | PNG | Reuse app icons |

- Compress to WebP for the web; keep originals in `landing-page/assets/`.

## 4. Alt-text rules (SEO + a11y)

Every image needs descriptive alt text, e.g.:

- `Screenshot of QR Hisab merchant dashboard showing total credit, collected and
  outstanding balances.`
- `Customer scanning a shop QR code in QR Hisab to see their khata balance.`

## 5. Do NOT

- Do not Photoshop fake numbers or fake approvals.
- Do not use illustrations as product shots.
- Do not capture a real user's data.
- Do not crop off app UI chrome awkwardly — keep full safe-area width.
