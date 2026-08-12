# QR Hisab — Competitor Analysis

How Nepali shops currently run credit, and what QR Hisab offers. Use the "differentiators"
as landing-page copy. Claims about competitors are general knowledge — verify before
printing anything comparative.

---

## The competitive landscape

### 1. Paper khata (the real incumbent — 90%+ of small shops)
- What it is: a hand-written ledger at the counter.
- Weaknesses: loss/damage, illegible, no summaries, arguments at settlement, credit given
  with no limits or warnings, no reminders, no backup.
- QR Hisab vs: **always in your pocket, searchable, summarized, reminder-ready,
  backed up, offline-capable.**

### 2. Khatabook / general khata apps
- What it is: digital ledger apps (often India-oriented, English-first).
- Weaknesses: not built for Nepali shops; QR-based customer access usually absent; no
  SMS reminders via Nepali gateways; no M2M shop-to-shop; sometimes paid tiers.
- QR Hisab vs: **made for Nepali shops (bilingual), QR access for customers with no app
  install, Aakash-SMS reminders, role switcher for shop-to-shop.**

### 3. Payment apps (eSewa, Khalti, FonePay, IME Pay)
- What it is: digital payments/QR at counter.
- Weaknesses: built for cashless *settlement*, not *credit tracking*. You can't record
  "owes me, will pay Friday". Not a khata.
- QR Hisab vs: **it tracks the credit itself; payments (cash/UPI-style/bank) are logged
  inside the khata.** Complementary, not competing — QR Hisab can accept these methods.

### 4. Excel / Google Sheets
- What it is: manual spreadsheet ledgers.
- Weaknesses: no shop-floor speed, no scan, no reminders, needs a computer, error-prone.
- QR Hisab vs: **mobile-first, scan-to-open, realtime, reminder-ready.**

### 5. Full ERP / POS suites (Tally, retail POS, inventory systems)
- What it is: big business software with billing/inventory.
- Weaknesses: heavy, expensive, desk-bound, overkill for a kirana shop.
- QR Hisab vs: **lightweight, free to start, phone-first, in Nepali context.**

---

## Positioning statement

> **For Nepali shop owners and traders who sell on credit, QR Hisab is a mobile-first
> digital khata that replaces the paper ledger — customers access their balance by
> scanning a QR (no app download), merchants get reminders, limits, and a realtime
> dashboard, and shop-to-shop credit all lives in one app.**

Differentiators to feature on the landing page:

1. **No customer app install** — QR + browser is the entire customer experience.
2. **Bilingual (Nepali/English) UI copy** — "Scan garera credit rakhnus".
3. **SMS reminders via a Nepali gateway** — reminder → payment loop.
4. **Merchant + customer in one account** — role switcher for shop-to-shop.
5. **Offline-first PWA** — works when the network doesn't.
6. **Free to start; only SMS credits cost money** (Rs 101/201/501).
7. **Rate-limited, audited, RLS-protected, HMAC-signed sessions** — see
   `TRUST_AND_SECURITY.md`.

---

## Avoid on landing

- Do NOT name-drop competitors in a comparative table unless you have legal-safe, verified
  facts. Say "paper khata", "spreadsheets", "generic khata apps" descriptively instead.
- Do NOT claim "only app that does X" without proof.
