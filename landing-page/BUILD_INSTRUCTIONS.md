# QR Hisab — Landing Page Build Instructions

How to turn these 17 documents into the shipped landing site. Read order first:
`APP_DOCUMENTATION.md` → `FEATURES.md` → `LANDING_PAGE.md` → `DESIGN_SYSTEM.md` →
`COPYWRITING.md`.

---

## 1. Decide where it lives

| Option | Pros | Cons |
|---|---|---|
| **A. Static route in this repo** (`/` or `/landing`), built with Next.js + Tailwind | Same stack, same deploy, shares design tokens | Must not break app routes/middleware; keep it out of auth |
| **B. Separate small repo** (Next.js/Vite static export) on the marketing domain | Independent deploys, no app risk | Two repos to maintain; needs domain + CI setup |

**Recommendation:** Option A at `/` with the app behind `/app`-style routing is risky
until routing is audited (app currently uses `/`, `/scan`, `/customer/*`, admin paths).
Check `src/middleware.ts` — the landing route must be **excluded from session-cookie
enforcement**. If that's not trivial, pick **Option B** on `qrhisab.com` with the app at
`app.qrhisab.com`.

## 2. Domain & deploy

- Marketing domain: `qrhisab.com` (currently aliased to the app).
- App domain: `app.qrhisab.com`.
- If marketing replaces the root alias, update the app's `COOKIE_DOMAIN`/links.
- Vercel: one project or two; set production deploy on merge to `main`.
- Keep `vercel.json` security headers on both.

## 3. Content assembly (map doc → section)

| Landing section | Build from |
|---|---|
| Top bar / nav | `LANDING_PAGE.md` §2 + `BRAND_GUIDE.md` |
| Hero | `COPYWRITING.md` §2 (exact strings) + hero visual per `SCREENSHOT_GUIDE.md` |
| Proof strip | `MISSING_INFORMATION.md` §1 — **only real numbers** |
| How it works | `COPYWRITING.md` §4 |
| Features (6 tiles) | `COPYWRITING.md` §5 + `FEATURES.md` |
| Shop-to-shop | `FEATURES.md` §5 + `USER_JOURNEY.md` Journey 4 |
| Offline | `FEATURES.md` §8 + Journey 5 |
| Security | `TRUST_AND_SECURITY.md` §3 (verified bullets only) |
| Pricing | `COPYWRITING.md` §6 (code-verified packages) |
| Testimonials | `MISSING_INFORMATION.md` §1 — placeholders only; replace or remove |
| FAQ | `FAQ.md` (+ JSON-LD) |
| Final CTA / footer | `LANDING_PAGE.md` §2; legal links per `TRUST_AND_SECURITY.md` §5 |

## 4. Technical checklist

- [ ] Route excluded from middleware session enforcement (Option A) or separate repo (B).
- [ ] Static/pre-rendered; Web Vitals pass.
- [ ] SEO per `SEO_GUIDE.md` (meta, JSON-LD, sitemap, alternates).
- [ ] Language toggle EN/ने (real, accessible).
- [ ] PWA install hint ("Add to home screen").
- [ ] Real screenshots per `SCREENSHOT_GUIDE.md`, captured after UI is final.
- [ ] Privacy policy, ToS, refund policy pages created and linked.
- [ ] Analytics decision made (currently none; privacy-respecting recommended).
- [ ] Redirect `/` → app where appropriate for logged-in users.

## 5. QA before launch

Run `CONTENT_CHECKLIST.md` top to bottom. Then on a staging deploy:
- Test all CTAs (signup, QR print, pricing, FAQ anchors).
- Test in EN + नेपाली at 375px and desktop.
- Confirm no UNKNOWN values slipped into copy (`grep` for "UNKNOWN" in final pages).
- Lighthouse: performance, a11y, SEO, best-practices ≥ 90.

## 6. After launch

- Submit to Search Console; add site; monitor.
- Add the launch funnel metrics (`MISSING_INFORMATION.md` §4 — analytics still needed).
- Re-run `SCREENSHOT_GUIDE.md` if the app UI ships changes.

## 7. Do not

- Do not build the landing page inside the app's authed routes without middleware review.
- Do not ship placeholder testimonials or unverified stats.
- Do not hard-code new hexes; read tokens from `globals.css`.
