# QR Hisab — Trust & Security

The security claims you may make on the landing page — **only the verified ones**. Each
claim maps to the code that implements it.

---

## 1. Verified security claims (safe to publish)

| Claim (marketing wording) | Implementation (code) |
|---|---|
| "Login with OTP + a 4–6 digit PIN" | OTP via Aakash SMS + `setPin`/`loginWithPin` (`src/app/actions/pin.ts`, `otp.ts`) |
| "Sessions are cryptographically signed" | HMAC-signed cookie `session`, 30-day (`src/lib/session.ts`) |
| "PINs are stored hashed (bcrypt)" | bcrypt PIN hashing |
| "Your data is protected at the database level" | Row Level Security (RLS) on tables |
| "SMS is rate-limited to stop spam" | rate limits on OTP/SMS (`src/app/actions/sms.ts`) |
| "AI bill reading is capped" | `MAX_DAILY_PARSES = 50`/day |
| "Every entry is attributed & audited" | `initiated_by`, idempotency keys, `sync_status` on credit logs |
| "Force-logout per device" | session monitor + force-logout (admin panel) |
| "Security headers on the site" | `vercel.json`: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy: camera=()` |
| "Works offline safely" | service worker + IndexedDB staging + idempotency keys |
| "No tracking/analytics scripts" | none found in repo (frame as "no hidden trackers" only if you keep it that way) |

## 2. Honest gaps (do NOT claim)

- **No end-to-end encryption** — `UNKNOWN`/not implemented. Say "encrypted in transit
  (HTTPS)" not "end-to-end encrypted".
- **Payment gateway is UAT/test mode** — do not claim live payments work.
- **No independent security audit / bug-bounty** — do not claim one.
- **No ISO/SOC certifications** — do not claim compliance.
- **No documented data-retention or deletion policy** — `UNKNOWN`
  (`MISSING_INFORMATION.md`).

## 3. Trust section copy (landing)

Headline: **"Your khata stays yours."**

Bullets (pick 4):
- "OTP login plus your own PIN."
- "Sessions signed and enforced; force-logout if your phone is lost."
- "Database-level access rules (RLS) — you only ever see your own khata."
- "Every entry carries a timestamp and who made it — no silent edits."
- "Works offline, syncs safely — no double entries."

Trust badges to show only if true:
- "HTTPS everywhere" ✓ (Vercel default — true).
- "100% free to start" ✓ (true; only SMS costs money).
- "Made in Nepal" — `UNKNOWN` team location; verify before claiming.

## 4. What the "no analytics" line means

No GA/Sentry/fingerprinting found in the repo. You may say "no tracking cookies" **only**
if you commit to not adding any on the landing page. Recommend adding privacy-respecting
analytics and a privacy policy (both currently `UNKNOWN`).

## 5. Privacy / legal (UNKNOWN — must create)

- Privacy policy: **does not exist** → write one.
- Terms of service: **does not exist** → write one.
- Refund policy for SMS credits: **does not exist** → write one.
- DPDP/Nepal data law compliance: `UNKNOWN`.

Link these in the footer. Do not launch the landing page without them.
