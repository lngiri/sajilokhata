# QR Hisab — User Journeys

End-to-end journeys to design the landing page around. Each journey notes the touchpoint
the landing page must support.

---

## Journey 1 — Kirana owner starts (merchant acquisition)

1. Sees QR Hisab ad/word-of-mouth (landing page).
2. **Landing touchpoint:** hero explains value in 5 seconds ("Your entire business in one
   digital khata") + primary CTA "Start Free".
3. Taps "Start Free" → opens app → enters phone → OTP → sets PIN.
4. Completes shop setup (name, business type, location).
5. Reaches dashboard; sees "how it works" tour; prints/opens the shop QR.
6. Adds products (optional), adds first customer, records first credit entry.
7. **Landing touchpoint:** success happens fast — the landing must promise "minutes, not
   days".

**Success metric:** first entry recorded within 10 minutes of signup.

---

## Journey 2 — Customer pays a credit (retention + virality)

1. Customer at counter says "khata ma rakhnus".
2. Merchant opens QR Hisab (or customer scans printed QR).
3. Customer scans QR → sees their balance + history.
4. Enters amount (or product-picker pre-fills it) → chooses "credit" or "payment".
5. Submits → merchant approves in real time.
6. Both see updated balance. Toasts confirm action.
7. **Landing touchpoint:** the "how it works" section must show this 4-step flow
   (Scan → Enter → Confirm → Done).

**Success metric:** repeat usage; customer returns because they know their balance.

---

## Journey 3 — Merchant reminds a customer to pay (payments loop)

1. Merchant's dashboard shows overdue customer.
2. Merchant taps "Remind" → SMS reminder sent (uses SMS credits).
3. Customer receives SMS; can open QR Hisab and pay.
4. Payment submitted → merchant confirms → balance clears.
5. **Landing touchpoint:** "Get paid — politely" section shows reminder SMS and credits.

**Success metric:** reminder → payment conversion; SMS credit purchase.

---

## Journey 4 — Shop-to-shop purchase (M2M)

1. Sita (pharmacy) buys from her wholesaler on credit.
2. Scans wholesaler's QR with her QR Hisab customer side.
3. Submits credit request → wholesaler approves.
4. Both shops' ledgers now match.
5. Later, dispute: she asks an edit request; wholesaler accepts; audit trail intact.
6. **Landing touchpoint:** "Shop-to-shop" section; both-role switcher explained.

---

## Journey 5 — Offline village shop (reliability)

1. Shop in an area with flaky network.
2. Merchant opens QR Hisab → service worker cache serves the app shell.
3. Records entries → queued in IndexedDB.
4. Network returns → synced; idempotency keys prevent double-posting.
5. **Landing touchpoint:** "Works even offline" section.

---

## Journey 6 — Billing / SMS credits purchase

1. Merchant wants 110 SMS reminders for Dashain.
2. Opens Billing → chooses package Rs 201 → pays via eSewa (UAT) or bank.
3. Credits appear → sends reminders.
4. **Landing touchpoint:** pricing section showing the three packages
   (Rs 101/50 SMS, Rs 201/110 SMS, Rs 501/300 SMS) and "how to pay".

---

## Journey 7 — Platform admin monitor (ops)

1. Admin logs into admin panel.
2. Sees dashboard: users, sessions, disputes, SMS usage, storage, health.
3. Force-logs-out a suspicious device; publishes announcement.
4. (Internal journey — not on landing, but a Trust section can mention "session control".)

---

## Map: journey → landing section

| Landing section (see `LANDING_PAGE.md`) | Supports journey(s) |
|---|---|
| Hero | 1 |
| How it works | 2 |
| Features | 1, 3, 4 |
| Shop-to-shop | 4 |
| Offline | 5 |
| Pricing | 3, 6 |
| Testimonials | 1–4 (placeholders → real) |
| FAQ | all |
