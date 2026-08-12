# QR Hisab — Missing Information (UNKNOWN)

Everything this documentation package could NOT verify against the codebase. Each item
must be resolved before the landing page can safely launch. Do not guess these on the
site.

---

## 1. User-generated & social proof

| Item | Status | Who owns it |
|---|---|---|
| Real user count (e.g. "10,000+ shops") | Not verifiable — hardcoded in landing code, no analytics to back it | Product owner |
| Total entries / credit volume (e.g. "100,000+", "Rs 25Cr+") | Not verifiable | Product owner |
| App store rating ("4.8/5") | Not verifiable (no store listing found) | Product owner |
| Real testimonials | Landing code has placeholders only (Ramesh/Sita/Ram) | Product owner + customers |
| Merchant photos / shop photos | None exist | Design + customers |

**Rule:** never publish these until confirmed with evidence. `TRUST_AND_SECURITY.md` and
`CONTENT_CHECKLIST.md` enforce this.

## 2. Legal & compliance

| Item | Status |
|---|---|
| Privacy policy | Does not exist — must be written |
| Terms of service | Does not exist — must be written |
| SMS credit refund policy | Does not exist — must be written |
| Nepal data-protection compliance | Unknown |
| GDPR/data handling for foreign customers | Unknown |

## 3. Payments & billing

| Item | Status |
|---|---|
| eSewa production (live) keys | UAT/test only in code |
| When SMS-credit purchases go live | Unknown |
| Bank-transfer flow for SMS credits | Exists in code, details unknown |
| Actual SMS gateway production token | Test/staging token assumed |

## 4. Analytics & infrastructure

| Item | Status |
|---|---|
| Analytics / GA / Sentry | None found — intentionally absent |
| Monitoring / error alerting | Unknown |
| Backups / DR policy | Unknown |
| Data retention & deletion policy | Unknown |

## 5. Brand assets

| Item | Status |
|---|---|
| Logo / logo files | None found in repo |
| Brand font with Devanagari support | Not confirmed in `globals.css` |
| Social media accounts | Not found |
| Contact email / support channel | Not found |

## 6. Product details

| Item | Status |
|---|---|
| Canonical app version | Inconsistent: 1.0.0 (`package.json`/About) vs 1.1.0 (`APP_VERSION`) |
| CSV import exact format | Feature exists; format not documented |
| Data export/backup format | Feature path exists; format unknown |
| Offline conflict-resolution rules | Beyond idempotency/sync_status — details unknown |
| Onboarding tour scope | Exists; exact steps not enumerated here |
| Gemini bill-parsing accuracy rates | Unknown |
| "Made in Nepal" / team location | Unknown |
| Pricing other than SMS credits | None found — free + SMS only |
| App store / Play Store listings | None found (web PWA only) |

## 7. Ops credentials / secrets (internal only — never public)

- Vercel: PAT needs revoking; Supabase service-role/PAT keys must be rotated if exposed;
  `SUPABASE_SERVICE_ROLE_KEY`, `AAKASH_SMS_TOKEN`, Gemini keys are secrets.
- Do NOT paste secrets into the landing page, screenshots, or any doc.

---

## How to use this list

1. Before launch, go through each item and either **resolve it** (get real data) or
   **decide it stays out** of the site.
2. Delete a row once resolved and note the evidence source in the doc that needs it.
3. Re-run `CONTENT_CHECKLIST.md` items that depend on resolved values.
