# QR Hisab — SEO Guide

Search-engine guidance for the landing site. Target: Nepali shop owners searching in
English and Devanagari.

---

## 1. Primary keywords

| Keyword | Intent | Target page/section |
|---|---|---|
| "khata app Nepal" | Merchant looking for ledger app | Hero/how-it-works |
| "digital khata" | Merchant | Hero/features |
| "credit ledger app for shop" | Merchant | Features |
| "shop khata" / "pasal ko khata" | Merchant (local) | Hero (Nepali block) |
| "खाता" / "सजिलो खाता" | Merchant (Devanagari) | Nepali hero |
| "qr code payment shop" | Merchant/Customer | QR section |
| "getapi / udhar app" | Merchant | Features/FAQ |

Pick 3–5 primary; long-tail for FAQ.

## 2. Meta (per landing section = separate routes if multi-page)

- **Title:** `QR Hisab — Digital Khata & Credit Ledger App for Nepali Shops` (~60 chars)
- **Description:** "Replace your paper khata. Track customer credit, shop-to-shop
  purchases and expenses on your phone. Customers check balances by scanning your QR —
  no app download. Start free." (~155 chars)
- **Canonical:** `https://qrhisab.com/` (or the marketing subdomain chosen in
  `BUILD_INSTRUCTIONS.md`).
- **Open Graph / Twitter cards:** product screenshot 1200×630, `og:type` website.

## 3. Structured data (JSON-LD)

- `SoftwareApplication` — name QR Hisab, `applicationCategory BusinessApplication`,
  `operatingSystem "Web"`, `offers` with free + SMS packages, aggregateRating only if real.
- `FAQPage` — wrap FAQ section for rich results.
- `Organization` — qrhisab.com with `sameAs` socials (add when they exist).

## 4. Technical

- Static, pre-rendered (Next.js static export or Vercel SSG) for instant LCP.
- Mobile-first; measure Core Web Vitals (LCP < 2.5s, CLS < 0.1, INP < 200ms).
- Canonical/alternate: `alternate` links for `/ne/` Nepali version of key pages.
- Robots: allow indexing; disallow nothing on landing.
- sitemap.xml + robots.txt referencing it.

## 5. Local SEO

- Business NAP (name/address/phone) consistent across footer + Google Business Profile.
- Nepali keywords in H2s and alt text.

## 6. Content plan (post-launch)

- Blog guides (seeded from FAQ): "How to manage khata in Nepal", "Shop-to-shop credit
  tips", "How to send payment reminders that work".
- Each blog → CTA back to Start Free.

## 7. Measured by

- Search Console (clicks/impressions for primary keywords).
- Landing CTA → merchant signup attribution (add analytics — see `MISSING_INFORMATION.md`:
  none exists today).
