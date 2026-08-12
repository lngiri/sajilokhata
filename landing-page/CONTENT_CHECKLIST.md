# QR Hisab — Pre-Launch Content Checklist

Final checklist before the landing page ships. Items map to their source document.

---

## A. Copy & content

- [ ] Hero H1/sub/CTA matches `COPYWRITING.md` (already-written strings in code).
- [ ] Every feature tile backed by `FEATURES.md`.
- [ ] All 4 how-it-works steps shown (Scan → Enter → Confirm → Done).
- [ ] Pricing cards match code exactly: Rs 101 → 50 SMS, Rs 201 → 110 SMS,
      Rs 501 → 300 SMS; "khata is free" framing.
- [ ] FAQ covers all `FAQ.md` items.
- [ ] Nepali version of hero + pricing provided (bilingual toggle).
- [ ] **No invented stats** — hardcoded landing stats (10,000+ owners, Rs 25Cr+, etc.)
      removed or confirmed real (`MISSING_INFORMATION.md`).
- [ ] **No fake testimonials** — placeholder quotes replaced with real, consent-given
      stories, or section removed.
- [ ] Version string reconciled (1.0.0 vs 1.1.0) before any "v" copy appears.

## B. Design & assets

- [ ] Colors/typography read from `globals.css` (no invented hexes).
- [ ] All imagery = real app screenshots per `SCREENSHOT_GUIDE.md`; alt text added.
- [ ] QR visuals scannable (quiet zone, no overlap).
- [ ] Mobile-first, accessible (contrast, focus, reduced motion).

## C. Trust & legal

- [ ] Privacy policy written and linked.
- [ ] Terms of service written and linked.
- [ ] SMS-credit refund policy written and linked.
- [ ] Only true security claims shown (`TRUST_AND_SECURITY.md` — no "E2E encrypted",
      no "certified").
- [ ] Payment gateway labeled as test/UAT until live.

## D. SEO

- [ ] Title/description/canonical/OG per `SEO_GUIDE.md`.
- [ ] JSON-LD (`SoftwareApplication` + `FAQPage` + `Organization`).
- [ ] sitemap.xml + robots.txt + `alternate` for Nepali pages.

## E. Technical

- [ ] Pre-rendered/SSG; Core Web Vitals pass (LCP < 2.5s, CLS < 0.1, INP < 200ms).
- [ ] Links to app verified: "Start Free" → correct signup route; QR print page link.
- [ ] 404/redirect check on all CTAs.
- [ ] Optional: privacy-respecting analytics added (currently none — decide).

## F. QA

- [ ] Full-page review in EN + नेपाली on phone (375px) and desktop.
- [ ] Click every CTA on a staging deploy.
- [ ] Spell-check + rupee formatting check.
- [ ] Screenshots re-taken if UI changed since `SCREENSHOT_GUIDE.md` was written.

## G. Post-launch

- [ ] Search Console added; site submitted.
- [ ] Launch message + blog CTA plan (see `SEO_GUIDE.md` §6).
- [ ] Monitor signup → first-entry funnel.
