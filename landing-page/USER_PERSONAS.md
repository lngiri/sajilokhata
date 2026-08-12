# QR Hisab — User Personas

Personas are derived from the product design (shop roles, business types, feature set).
**The included names/photos are placeholders** — replace with real customer stories before
launch (see `MISSING_INFORMATION.md`). Each persona notes which personas are
code-confirmed vs assumed.

---

## Persona 1 — The Kirana Owner (primary merchant)

- **Name (placeholder):** Ram K.
- **Profile:** 38, runs a family kirana store in Kathmandu valley. Wife + one helper.
- **Daily reality:** 60–120 customers/day; most regulars buy on credit and settle weekly
  or on payday. Paper khata book has 3 months of hand-written pages, sometimes lost or
  double-entered.
- **Pain points:**
  - Can't remember who owes what; arguments at settlement time.
  - Credit given without limits → bad debt from a few customers.
  - No record of product-level detail, so can't price credit right.
  - Chasing payments is awkward and eats shop-floor time.
- **Wants:** a fast ledger that's always in his pocket, automatic reminders, and a way to
  say "no more credit" to risky names.
- **How QR Hisab fits:** dashboard + credit limits + flags + SMS reminders + QR access so
  customers never have to install anything. Product picker speeds entry during rush hour.
- **Motto for copy:** "Sell fast, never forget, get paid."

---

## Persona 2 — The Pharmacy / Hardware Merchant

- **Name (placeholder):** Sita D.
- **Profile:** 45, owns a pharmacy in Pokhara; also does small wholesale to 3 other shops.
- **Daily reality:** Mixture of cash, credit to known customers, and **shop-to-shop
  purchases** — she buys from a wholesaler on credit and sells to shops on credit.
- **Pain points:** Two ledgers (in + out), no single balance view; wholesaler's numbers
  vs her numbers rarely match.
- **Wants:** one app for both roles (buyer and seller), per-shop balances, dispute
  resolution when the other side's number differs.
- **How QR Hisab fits:** role switcher (merchant + customer), M2M purchase flow, entry
  statuses, dispute/edit requests, credit limits per shop.
- **Motto for copy:** "Your shop-to-shop credit, all in one khata."

---

## Persona 3 — The Customer (credit buyer)

- **Name (placeholder):** Anil
- **Profile:** 29, driver/worker, pays weekly or on Dashain/Tihar when salary hits.
- **Daily reality:** Buys daily essentials on credit from the local store. Never wants to
  install another app.
- **Pain points:** Doesn't keep track of what he owes; gets surprised at settlement; hates
  being publicly "called out" in front of the shop.
- **Wants:** to know his balance privately, and to settle without awkwardness.
- **How QR Hisab fits:** scan the shop QR → see balance → pay → merchant confirms. No app
  download. PIN-protected so a friend's phone doesn't leak his balance.
- **Motto for copy:** "Know what you owe. Pay in a tap."

---

## Persona 4 — The Admin / Platform Owner

- **Profile:** the QR Hisab team.
- **Reality:** monitors users, sessions, disputes, SMS usage, storage, health; force-logs-out
  suspicious devices; publishes announcements and branding.
- **How QR Hisab fits:** self-service admin panel + session monitor.

---

## Personas summary table

| # | Persona | Role in app | Priority | Code-confirmed? |
|---|---|---|---|---|
| 1 | Kirana owner | Merchant | P0 | Yes (merchant features) |
| 2 | Pharmacy/wholesaler | Merchant + Customer | P1 | Yes (role switcher, M2M) |
| 3 | Credit buyer | Customer | P1 | Yes (customer flow) |
| 4 | Platform admin | Admin | P2 | Yes (admin panel) |

> Replace placeholder names with real, consent-given stories. Add photos of real shops
> (with permission). Never present placeholders as real testimonials.
