# QR Hisab — Brand Guide

Brand foundations derived from the product, its copy, and its target market.

---

## 1. Brand essence

- **Who we are:** the digital khata for Nepali shops and traders.
- **Personality:** trustworthy, local, practical, warm. Think "the reliable counter
  book, upgraded". Not flashy, not corporate.
- **Voice keywords:** simple, friendly, clear, business-like, bilingual-friendly.
- **Voice anti-keywords:** jargon, hype, fear, condescension.

## 2. Brand names

| Context | Name |
|---|---|
| Product / marketing | **QR Hisab** |
| Nepali | **सजिलो खाता** (project/repo name; also "easy khata") |
| Domain | `qrhisab.com` (prod app aliased here); app at `app.qrhisab.com` |
| Logo mark | **UNKNOWN** — no logo assets found in the codebase. Design one: a QR tile + a khata/ledger line motif. |

## 3. Positioning

> For Nepali shop owners and traders who sell on credit, QR Hisab is the mobile-first
> digital khata that replaces the paper ledger — customers check balances by scanning a
> QR (no app download), merchants get reminders, credit limits, and a realtime dashboard,
> and shop-to-shop credit lives in one app. Unlike paper khata, spreadsheets, or
> India-first khata apps, QR Hisab is built for Nepali shops: bilingual, offline-first,
> and free to start.

## 4. Tagline options (choose one)

1. **"Your entire business in one digital khata"** (existing hero H1 — use it).
2. "Nepali shopko lagi digital credit ledger." (from `package.json`).
3. "Sell fast. Never forget. Get paid." (persona-driven).
4. Nepali: "आफ्नो पूरै व्यापार एउटै डिजिटल खातामा।"

## 5. Key messages

- **Problem:** paper khata gets lost, arguments at settlement, no reminders, credit given
  blindly.
- **Solution:** QR Hisab digitizes the khata; QR access for customers; SMS reminders;
  limits & flags; realtime dashboard; works offline.
- **Proof/credibility:** PIN + HMAC sessions, RLS, audit trail, offline sync. (Only real,
  verified claims — see `TRUST_AND_SECURITY.md`.)
- **Urgency/action:** "Start Free. Record your first entry in minutes."

## 6. Bilingual messaging rules

- Primary copy: English with Nepali key phrases where natural (e.g., QR print page's
  "Scan garera credit rakhnus" — "scan and keep the credit").
- Provide a full नेपाली version of hero, how-it-works, and pricing.
- Numbers use Nepali conventions (Rs, comma grouping).

## 7. Do / Don't

**Do:** speak to shop reality (busy counter, one phone, paper lost), emphasize speed and
simplicity, keep a friendly local tone, back every claim with a feature.

**Don't:** invent testimonials/stats (see `MISSING_INFORMATION.md`), claim to replace
banks, use English-only jargon, over-promise AI ("bill reading" is rate-limited and beta).

## 8. Visual style

- Mobile-first, airy, plenty of white space.
- Real product screenshots (not mock illustrations) — `SCREENSHOT_GUIDE.md`.
- Colors/typography: use the app's design tokens from `DESIGN_SYSTEM.md`.
