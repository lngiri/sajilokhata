# QR Hisab (सजिलो खाता) — Landing Page Documentation Package

This folder contains the complete documentation package for building and shipping the
**QR Hisab** marketing/landing website. Every document was compiled directly from the
production codebase (`src/`, `supabase/migrations/`, `package.json`, `next.config.ts`,
`vercel.json`, `public/`) — nothing is invented.

## Product identity

| Field | Value |
|---|---|
| Product name | **QR Hisab** |
| Nepali name | **सजिलो खाता** (repo/project name: `SajiloKhata`) |
| One-liner | "Nepali shopko lagi digital credit ledger. Mobile-first PWA." |
| Category | Digital credit ledger / khata app for small shops & traders |
| Target market | Nepal — kirana stores, pharmacies, hardware shops, restaurants, wholesalers |
| Platform | Web PWA (installable), mobile-first, offline-capable |

## The 17 documents

### Core product documentation
1. [`APP_DOCUMENTATION.md`](./APP_DOCUMENTATION.md) — What the product is, roles, flows, architecture, deployment.
2. [`FEATURES.md`](./FEATURES.md) — Full, code-verified feature inventory for marketing copy.

### Audience & strategy
3. [`USER_PERSONAS.md`](./USER_PERSONAS.md) — Who the users are and what they need.
4. [`USER_JOURNEY.md`](./USER_JOURNEY.md) — End-to-end journeys for each persona.
5. [`COMPETITOR_ANALYSIS.md`](./COMPETITOR_ANALYSIS.md) — How QR Hisab differs from alternatives.

### Design & brand
6. [`LANDING_PAGE.md`](./LANDING_PAGE.md) — The landing page itself: structure, sections, copy.
7. [`BRAND_GUIDE.md`](./BRAND_GUIDE.md) — Brand voice, messaging, positioning.
8. [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — Colors, typography, components, motion.
9. [`COPYWRITING.md`](./COPYWRITING.md) — Headlines, buttons, microcopy, tone rules.

### Marketing & growth
10. [`SEO_GUIDE.md`](./SEO_GUIDE.md) — Meta, structure, local SEO, content plan.
11. [`SCREENSHOT_GUIDE.md`](./SCREENSHOT_GUIDE.md) — What to capture in the app for imagery.
12. [`TRUST_AND_SECURITY.md`](./TRUST_AND_SECURITY.md) — Security story, claims, badges.
13. [`FAQ.md`](./FAQ.md) — Questions to answer on the landing page.

### Delivery & quality
14. [`CONTENT_CHECKLIST.md`](./CONTENT_CHECKLIST.md) — Pre-launch checklist.
15. [`MISSING_INFORMATION.md`](./MISSING_INFORMATION.md) — Facts we could not verify (marked `UNKNOWN`).
16. [`BUILD_INSTRUCTIONS.md`](./BUILD_INSTRUCTIONS.md) — How to build the landing page from these docs.

## Source-of-truth note

The live product is a Next.js app. The following files were the primary evidence sources:

- `package.json` — name, version, tagline, dependencies.
- `src/app/layout.tsx` — metadata, branding strings, theme color.
- `src/app/globals.css` — design tokens, colors, typography.
- `public/sw.js` — offline/PWA cache.
- `public/manifest.webmanifest`, icons — PWA metadata.
- `vercel.json` — security headers.
- `next.config.ts` — build configuration.
- `supabase/migrations/*` — schema (merchants, customers, credit_logs, products, sessions, notifications, SMS, billing).
- `src/app/actions/*` — every business action (pin, customer, merchant, products, otp, sms, sms-billing, notifications, ai/parse-bill).
- `src/app/api/*` — API routes (customer/session, verify/approve, auth/bypass, merchant/setup, health, ai/parse-bill).

Any fact that could NOT be verified against the codebase is explicitly marked `UNKNOWN`
and listed in [`MISSING_INFORMATION.md`](./MISSING_INFORMATION.md). Do not invent numbers,
testimonials, or capabilities on the landing page.

## Reading order

Start with [`APP_DOCUMENTATION.md`](./APP_DOCUMENTATION.md), then
[`FEATURES.md`](./FEATURES.md), then [`LANDING_PAGE.md`](./LANDING_PAGE.md).
