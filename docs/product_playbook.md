# Product Playbook — QR Hisab (Sajilo Khata)

The authoritative product guide. Read this to understand what QR Hisab is, who it serves, and how it works — without reading the codebase.

---

## Product Overview

**QR Hisab** (सजिलो खाता) is a digital credit ledger for small retail shops in Nepal. It replaces the paper notebook (khata) that shopkeepers use to track who owes them money.

A shopkeeper prints a QR code and keeps it at the counter. Customers scan the QR with their phone to record credit transactions. Both parties see the same ledger. Payments are tracked. Disputes are resolved digitally. SMS reminders collect debts automatically.

The product runs as a Progressive Web App — no app store download required. It works on any phone with a browser, including offline in areas with poor connectivity.

### Why It Exists

Small shops in Nepal (kirana, dairy, hardware, pharmacy) operate on credit. A customer takes goods today and promises to pay later. The shopkeeper writes this in a paper notebook. Problems:

- Notebooks get lost, torn, or damaged.
- Customers forget what they owe.
- There is no digital record to settle disputes.
- Shopkeepers spend hours calculating totals manually.
- Payment collection requires phone calls or visits.

QR Hisab solves all of these with a free, mobile-first digital ledger.

### Product Philosophy

1. **Customer data entry, not merchant data entry.** The customer scans the QR and enters the transaction. The merchant only approves. This reduces the shopkeeper's workload by 80%.
2. **Two-party verification.** Neither party can unilaterally record a credit transaction. The merchant creates it, the customer confirms it. This builds trust.
3. **Works offline.** Nepal has unreliable connectivity in many areas. The app queues transactions locally and syncs when online.
4. **No app download.** A PWA runs in the browser. Users install it to their home screen optionally, but it works without installation.
5. **Positive language.** The UI avoids words like "debt" or "udharo". It uses "credit", "balance", "ledger" — professional, not shameful.

---

## Vision

### Mission

Every small shop in Nepal deserves a professional, free, and trustworthy way to manage credit. QR Hisab puts a digital ledger in every shopkeeper's pocket.

### Long-Term Vision

A complete financial operating system for Nepal's informal retail economy — credit management, payment collection, product catalog, business analytics, and customer relationships — all in one app that works on any phone.

### Core Principles

1. **Free for basic use.** Core ledger functionality is always free. Revenue comes from premium features (SMS credits), not from locking merchants out.
2. **Works on any phone.** No smartphone required for basic features. SMS ensures customers with feature phones can still receive notifications.
3. **Trust through transparency.** Both merchant and customer see the same data. Disputes are resolved digitally, not physically.
4. **Offline-first.** Every core feature works without internet. Data syncs automatically when connectivity returns.
5. **Nepal-first.** Built for Nepali phone numbers (+977), Nepali payment systems (eSewa), Nepali SMS gateways (Aakash), and Nepali languages in the UI.

---

## Target Users

### Primary: Small Shop Owners (Merchants)

**Who they are:** Owners of kirana (grocery), dairy, meat, hardware, clothing, pharmacy, and restaurant shops. Typically managing 20–200+ customers on credit.

**What they need:**
- A simple way to track who owes them money
- A way to remind customers to pay
- A record they can trust for settling disputes
- Business analytics (daily sales, outstanding totals, cash flow)

**What they don't need:**
- Complex accounting software (QuickBooks, Tally)
- Features designed for large businesses
- Complicated registration processes

**How they use the product:** Every day, at the shop counter. They show their QR code. Customers scan and enter transactions. The merchant reviews and approves pending entries. At month-end, they send payment reminders and review their dashboard.

### Secondary: Customers

**Who they are:** People who buy from small shops on credit. Ranges from daily customers (buying milk, rice) to monthly customers (buying hardware, supplies).

**What they need:**
- A clear view of what they owe across all their shops
- A way to confirm or dispute transactions
- A way to submit payments with proof (screenshot)
- No complicated registration (phone number + PIN)

**How they use the product:** Occasionally. They scan the shop QR to record a transaction, check their history when they want to verify a balance, and submit payment vouchers when they pay.

### Dual-Role Users

Many Nepali shopkeepers are also customers at other shops. A dairy owner buys groceries at a kirana store. A hardware shop owner buys milk at a dairy. These users need both merchant and customer views under the same phone number.

### Businesses That Benefit Most

- Kirana / grocery shops (daily credit cycles)
- Dairy / milk delivery (product-based quantity tracking)
- Meat shops (daily credit cycles)
- Hardware stores (high-value, low-frequency credit)
- Pharmacies (recurring credit customers)
- Restaurants (staff credit accounts)

### Businesses That Are Not the Primary Target

- Large enterprises with existing ERP systems
- Businesses without recurring credit relationships
- Businesses that only accept cash (no credit to track)

---

## Problems Being Solved

### Traditional Ledger Problems

| Problem | Impact |
|---------|--------|
| Paper notebooks get lost, torn, or stolen | Permanent loss of financial records |
| Handwriting is illegible over time | Disputes about amounts |
| Manual calculations are error-prone | Incorrect balances, lost money |
| No backup or recovery | Fire, flood, or theft destroys records |
| Cannot be shared between locations | Multi-device access impossible |

### Merchant Pain Points

| Pain Point | How QR Hisab Solves It |
|-----------|----------------------|
| Customers forget what they owe | Digital ledger with instant balance lookup |
| No way to remind customers to pay | SMS payment reminders, WhatsApp sharing |
| Disputes about amounts | Two-party verification — customer confirms each entry |
| Hours adding up columns at month-end | Automatic balance computation |
| No visibility into cash flow | Dashboard with daily sales, outstanding, cash in hand |
| No digital credit tracking | Product-based credit ledger with automatic calculations |

### Customer Pain Points

| Pain Point | How QR Hisab Solves It |
|-----------|----------------------|
| Don't know exact balance at a shop | Real-time balance view across all shops |
| Shopkeeper's records are one-sided | Customer can confirm, dispute, or edit entries |
| No proof of payment | Upload payment vouchers with screenshots |
| Need to visit shop to check balance | View history from phone, anytime |

### Offline Challenges

Nepal has unreliable internet connectivity in rural and semi-urban areas. A digital ledger that only works online is useless for a dairy delivery person on a mountain road. QR Hisab queues all transactions locally in IndexedDB and syncs automatically when connectivity returns. The offline indicator shows pending items and sync status.

### Trust Issues

In a paper ledger, the shopkeeper has total control. They can write any amount. The customer has no recourse. QR Hisab enforces a two-party consent model: the merchant records the transaction, but the customer must verify it. Disputes are flagged and visible to both parties. An admin panel resolves escalated disputes.

---

## Solution

### How QR Hisab Solves Each Problem

| Problem | Solution |
|---------|----------|
| Paper records get lost | Cloud-synced digital ledger with offline backup |
| Customers forget debts | Instant balance lookup + automatic SMS reminders |
| Manual calculation errors | Automatic computation for all balances and totals |
| One-sided records | Two-party verification — both merchant and customer confirm |
| No payment trail | Every transaction has timestamp, type, status, and audit log |
| Product tracking | Product Master auto-fills rates and calculates totals |
| Offline unreliability | IndexedDB offline queue with automatic sync |
| Customer onboarding friction | Phone number + PIN registration, no email required |
| Business insights missing | Dashboard with analytics, charts, CSV/Excel export |

### Why the Approach Is Different

Most accounting apps are merchant-focused data entry tools. The merchant types everything. QR Hisab shifts data entry to the customer. The customer scans the shop QR and records the transaction themselves. The merchant only approves. This fundamentally changes the workflow — it's faster, more accurate, and builds trust because both parties see the same data.

The second differentiator is offline-first design. Most SaaS products assume reliable internet. QR Hisab assumes unreliable internet and works perfectly without it.

---

## Product Positioning

### Category

Digital credit ledger / financial management tool for informal retail.

### Competitive Alternatives

| Alternative | Limitation |
|------------|-----------|
| Paper notebook (khata) | Lost easily, no digital record, no reminders |
| Excel / Google Sheets | Not mobile-friendly, no two-party verification, no SMS |
| WhatsApp messages | Unstructured, no balance computation, easily deleted |
| Generic accounting apps (Khata Book, Vyapar) | Not built for Nepal, no offline support, no two-party verification |
| Bank apps | Only track bank transactions, not informal credit |

### What Makes QR Hisab Different

1. **Customer-initiated transactions.** The customer scans and enters, not the merchant. This is unique in the category.
2. **Two-party verification.** Both parties must agree on every credit entry. No other khata app enforces this.
3. **Offline-first.** Works without internet. Queues and syncs automatically.
4. **Nepal-native.** Built for Nepali phone numbers, eSewa payments, Aakash SMS, and local business patterns.
5. **Free core.** The ledger is free forever. Revenue comes from optional SMS credits.

### Unique Value Proposition

"QR Hisab is the only digital ledger where both the shopkeeper and customer see the same record and must agree on every transaction. It works offline, sends SMS reminders, and costs nothing for basic use."

---

## Core Features

### Core (The Product Wouldn't Exist Without These)

| Feature | Why It Exists | Who Uses It | Business Value |
|---------|--------------|-------------|----------------|
| **QR Code Transaction Initiation** | Eliminates merchant data entry. Customer scans shop QR and records the transaction. | Merchant (displays), Customer (scans) | 80% reduction in merchant data entry workload |
| **Digital Credit Ledger** | Replaces paper notebook with searchable, filterable, cloud-synced record. | Both | Never lose a financial record again |
| **Two-Party Verification** | Prevents unilateral ledger manipulation. Customer confirms or disputes every credit entry. | Merchant (creates), Customer (confirms/disputes) | Builds trust, eliminates disputes |
| **Dashboard** | Provides instant visibility into outstanding balances, daily sales, pending approvals, and cash in hand. | Merchant | Real-time business intelligence |
| **Transaction History** | Searchable, filterable record of all transactions with status tracking. | Both | Instant balance lookup, audit trail |
| **Balance Computation** | Automatic calculation of outstanding balances from approved transactions. | Both | Eliminates manual calculation errors |

### Advanced

| Feature | Why It Exists | Who Uses It | Business Value |
|---------|--------------|-------------|----------------|
| **SMS Payment Reminders** | Customers forget to pay. Automated reminders collect debts without manual follow-up. | Merchant (sends), Customer (receives) | Faster debt collection, reduced bad debts |
| **WhatsApp / Share Link Reminders** | Free alternative to paid SMS. Merchants can send reminders via WhatsApp or copy a link. | Merchant | Zero-cost reminder channel |
| **Manual Entry with AI Bill Scan** | Merchants record transactions by entering amounts. AI scans paper bills to auto-fill amounts. | Merchant | Faster data entry, reduced errors |
| **Bulk Customer Import** | Migrating from paper to digital requires importing existing customers. CSV/Excel upload with SMS notification. | Merchant | Cold-start problem solved — onboard 50+ customers in minutes |
| **Cash Sales Ledger** | Cash transactions are a blind spot in credit-focused ledgers. Dedicated cash tracking with receipt view. | Merchant | Complete financial picture |
| **Financial Reports** | Charts, metrics, top customers, cash flow trends, CSV export. | Merchant | Business intelligence for decision-making |
| **Edit Request Flow** | Customer can propose amount changes without destroying the original record. Merchant accepts or rejects. | Both | Collaborative dispute resolution |
| **Dispute Resolution** | Customer can flag incorrect entries. Disputes surface in admin panel for resolution. | Customer (flags), Admin (resolves) | Fair, transparent conflict resolution |

### Administrative

| Feature | Why It Exists | Who Uses It | Business Value |
|---------|--------------|-------------|----------------|
| **Admin Dashboard** | Platform operators need visibility into system health, user activity, and disputes. | Admin | Platform operations |
| **Force Logout Kill-Switch** | Compromised merchant accounts can be remotely terminated. | Admin | Security |
| **Anomaly Detection** | High-volume merchants and disputed transactions are flagged automatically. | Admin | Early warning system |
| **User Directory** | Unified view of all merchants and customers with role detection. | Admin | User management |

### Security

| Feature | Why It Exists | Who Uses It | Business Value |
|---------|--------------|-------------|----------------|
| **PIN Authentication** | Simple, familiar security for shopkeepers. 4-digit PIN protects accounts. | Both | Account security without complexity |
| **OTP Verification** | Phone-based OTP for registration and forgot-PIN flows. | Both | Identity verification |
| **Session Cookies** | 30-day persistent sessions. Users stay logged in across browser restarts. | Both | Seamless daily use |
| **Customer PIN Gate** | Customer dashboard is protected by PIN. Prevents unauthorized access on shared phones. | Customer | Privacy on shared devices |
| **Trust Status System** | Merchants can flag unreliable customers (good / warning / defaulter). | Merchant | Community safety |

### Offline

| Feature | Why It Exists | Who Uses It | Business Value |
|---------|--------------|-------------|----------------|
| **Offline Transaction Queue** | Transactions created without internet are stored locally and synced automatically. | Both | Works in areas with poor connectivity |
| **Offline Indicator** | Shows pending items count and sync status. Prevents "did it go through?" anxiety. | Merchant | Confidence in offline mode |
| **Automatic Sync** | Pending items sync one-by-one when connectivity returns, with timeout protection. | System | Data integrity |
| **Reverse QR (Offline Mode)** | When customer is offline, they show their own QR for the merchant to scan later. | Both | Transaction recording works even when customer is offline |

### Architecture & Data Model

| Concept | Why It Exists | Who Benefits | Business Value |
|---------|--------------|-------------|----------------|
| **Many-to-Many Ledger** | A customer shops at multiple merchants. Each merchant-customer pair has its own isolated credit account. Customer sees unified view of all liabilities. | Both | One place to see everything owed, complete financial picture |
| **Dual Unit Matrix** | Kirana uses monetary values (NPR). Product Master tracks quantity metrics (Liters, Jars, Kgs). Different businesses track credit differently. | Merchant | Tracks credit in the unit that makes sense for the business type |
| **Multi-Device Sessions** | Family members or employees may manage the same shop from different phones. Concurrent active sessions are supported. | Merchant | No seat limits, team collaboration |
| **Partial Payment Settlements** | Customers rarely pay the full balance at once. Payments settle the oldest outstanding balance first (FIFO). Recursive balance model tracks what remains. | Both | Accurate balance tracking when payments are partial |
| **Account Migration & Recovery** | Merchants can migrate customer data from other systems. Admin can recover accounts when merchants lose access. | Admin, Merchant | Business continuity, data recovery |

### Payments

| Feature | Why It Exists | Who Uses It | Business Value |
|---------|--------------|-------------|----------------|
| **Payment Method Configuration** | Merchants configure how customers can pay them (QR codes, bank details, cash). | Merchant | Professional payment collection |
| **Payment Voucher Upload** | Customers submit payment proof with screenshot. Merchant approves. | Customer (submits), Merchant (approves) | Verified payment trail |
| **SMS Credit Packages** | Prepaid SMS credits via eSewa or bank transfer. Three tiers (Rs. 101/201/501). | Merchant | Monetization + SMS delivery |
| **eSewa Integration** | Direct payment to eSewa (currently UAT, production planned). | Merchant | Automated payment collection |
| **Auto-Reminder Settings** | Monthly automated SMS reminders on a configurable day of the month. | Merchant | Hands-off debt collection |

### AI

| Feature | Why It Exists | Who Uses It | Business Value |
|---------|--------------|-------------|----------------|
| **Bill Scanning (Google Gemini 2.5 Flash)** | Snap a photo of a paper bill, AI extracts the total amount and item summary. | Merchant | Faster entry, reduced typing |

### Reporting

| Feature | Why It Exists | Who Uses It | Business Value |
|---------|--------------|-------------|----------------|
| **Dashboard Stats** | Outstanding, today's sales, customer count, pending count — all at a glance. | Merchant | Quick business health check |
| **Cash Flow Chart** | Area chart showing credit given, cash sales, and payments received over time. | Merchant | Trend analysis |
| **Top Customers Chart** | Horizontal bar chart of customers ranked by outstanding balance. | Merchant | Identify biggest debtors |
| **Transaction Audit Log** | Filterable table of all transactions with status, type, and amount. | Merchant | Detailed financial review |
| **CSV Export** | Download filtered transactions as a spreadsheet for accounting or tax purposes. | Merchant | Data portability |
| **JSON Export** | Download raw data backup. | Merchant | Data backup |

---

## User Journeys

### New Merchant

1. Opens QR Hisab landing page on phone or desktop.
2. Taps "Start Free".
3. Enters phone number → receives OTP → verifies.
4. Selects "Merchant" role.
5. Sets a 4-digit PIN (or skips).
6. Sees empty dashboard with onboarding prompt.
7. Updates business name, address, and type.
8. Prints their shop QR code from the QR page.
9. Keeps QR at the counter. Customers start scanning.
10. Reviews and approves first pending entries.
11. Sees balances accumulate on dashboard.

### Returning Merchant

1. Opens QR Hisab → lands on dashboard (session persists for 30 days).
2. Checks outstanding balance, pending approvals, today's sales.
3. Approves pending customer entries (inline or via modal).
4. Sends SMS payment reminder to a customer who owes money.
5. Checks reports for weekly/monthly trends.
6. Recharges SMS credits when balance is low.

### Customer

1. Visits a shop → sees QR code at counter.
2. Scans QR with phone camera.
3. Enters phone number (first time only — saved for next time).
4. Toggles between "Credit Taken" and "Payment".
5. Enters amount and description → submits.
6. Sees "Request sent — awaiting merchant approval".
7. Later, checks transaction history to verify balance.
8. When paying, uploads payment voucher screenshot.
9. Receives SMS notification when entry is approved.

### Dual-Role User

1. Logs in as merchant → sees merchant dashboard.
2. `RoleSwitcher` button appears in header (small pill showing current role).
3. Taps "Switch" → redirects to customer dashboard.
4. Sees their outstanding balances across all shops.
5. Switches back to merchant view when done.
6. Also sees `OtherRolePrompt` — "Also use as Customer?" — if they haven't registered the second role yet.

### Admin

1. Navigates to `/admin/login` → enters email + password.
2. Sees admin dashboard with total merchants, customers, active transactions.
3. Checks anomaly alerts (high-volume merchants, disputes).
4. Reviews pending SMS recharge requests → approves or rejects.
5. Monitors session activity → force-logout if suspicious.
6. Resolves disputed transactions between merchants and customers.

---

## Authentication Experience

### Registration

1. Enter phone number.
2. Receive 6-digit OTP via SMS.
3. Enter OTP.
4. Choose role: Merchant or Customer.
5. Set a 4-digit PIN (or skip).
6. Done — redirected to dashboard.

### Daily Login

1. Open QR Hisab.
2. Enter phone number (pre-filled if returning).
3. Enter 4-digit PIN.
4. Redirected to dashboard.

### Forgot PIN

1. Tap "Forgot PIN?" on the PIN screen.
2. Enter phone number → receive OTP.
3. Enter OTP → set new PIN.
4. Redirected to dashboard.

### Post Sign-Out Quick Re-login

After signing out, the app remembers which role you used. Next time you open the app, you see a quick "Continue as Merchant" or "Continue as Customer" option — no phone number entry needed.

---

## Role System

### Merchant

The shop owner. They:
- Display their QR code for customers to scan
- Review and approve/reject pending credit entries
- Send payment reminders (SMS, WhatsApp, share link)
- Manage customer credit limits
- View dashboard with business analytics
- Configure payment methods
- Import customers in bulk
- Export data as CSV/JSON

### Customer

The person who buys on credit. They:
- Scan shop QR codes to record transactions
- View their outstanding balance across all shops
- Confirm, dispute, or edit unverified entries
- Submit payment vouchers with screenshots
- View transaction history
- Manage their profile

### Dual-Role

A single phone number that is both a merchant and a customer. The same UUID is shared across both roles in the database. The user sees a role switcher in the dashboard header and can toggle between views without re-authenticating.

### Role Switching

The `RoleSwitcher` component appears in the dashboard header when the user has both roles. Tapping it saves the target role to localStorage and performs a hard page reload to the appropriate dashboard.

### Add-Role Flow

The `OtherRolePrompt` component appears once per session for single-role users. It suggests registering for the second role (e.g., "Also use as Customer?"). Tapping "Register" navigates to the login page with an `?addRole=` parameter, which routes through OTP verification → role creation → PIN setup, reusing the existing UUID.

---

## Product Workflow

### Daily Operations — Kirana Shop

**Morning:**
1. Merchant opens QR Hisab → dashboard shows outstanding balance across all customers.
2. Checks pending approvals from last night's late entries.
3. Approves 3 pending credit entries.

**During the day:**
4. Customer A scans shop QR → enters "Rice 10kg, Rs. 800" as credit → merchant sees pending entry → approves.
5. Customer B scans shop QR → enters Rs. 500 payment → merchant sees payment entry → approves.
6. Merchant manually records a cash sale of Rs. 200.
7. AI bill scan: merchant photographs a wholesale bill → AI extracts Rs. 12,500 → merchant adds description → confirms.

**End of day:**
8. Dashboard shows: Rs. 1,500 total sales, Rs. 45,200 outstanding across 23 customers, 5 pending approvals.
9. Merchant sends SMS reminder to Customer C (Rs. 3,500 outstanding, 45 days overdue).
10. Exports CSV for monthly accounting.

### Transaction Entry — Dairy (with Products)

1. Merchant opens Manual Entry → sees product picker with Milk, Curd, etc.
2. Taps 'Milk' → auto-fills: description='Milk', amount=55, quantity=1, unit=liter
3. Adjusts quantity to 2 → amount auto-updates to 110
4. Confirms → credit log + line item saved

### Customer Payment Flow

1. Customer opens QR Hisab → sees Rs. 3,500 outstanding at Ramesh's Shop.
2. Taps "Pay Now" → sees shop's payment methods (eSewa QR, bank details).
3. Pays Rs. 3,500 via eSewa.
4. Takes screenshot → uploads as payment voucher.
5. Merchant sees pending payment entry → approves.
6. Customer receives SMS: "Rs. 3,500 credited to your account at Ramesh's Shop."

---

## Trust & Security

### What Builds User Confidence

1. **Two-party verification.** Neither the merchant nor the customer can unilaterally change the ledger. Every credit entry requires confirmation from the other party.
2. **Transparent records.** Both parties see the same data. There is no "his word vs. hers" — the ledger is shared.
3. **Dispute resolution.** Customers can flag incorrect entries. Disputed entries are excluded from active credit balances and held in Pending state until mutual re-approval. Disputes are visible and resolvable without physical visits.
4. **Payment vouchers.** Customers upload screenshots as proof of payment. Merchants approve them. Both have evidence.
5. **Audit trail.** Every change is logged with timestamp, actor, and previous values. Nothing is silently modified.
6. **PIN protection.** Accounts are protected by 4-digit PINs. Customer dashboard requires PIN entry.
7. **Offline reliability.** Transactions are queued locally and never lost, even without internet.
8. **Product Master.** Products are configured once per merchant; rates auto-fill during transactions.
9. **Free core.** The ledger is free. No hidden fees, no subscription traps.

---

## Offline Experience

### What Works Offline

- Recording credit entries (debit, credit, cash)
- Viewing cached customer data and balances
- Scanning QR codes (reverse QR flow for customer-initiated entries)
- Product-based transaction entry
- Viewing recently loaded dashboard data

### What Requires Internet

- SMS payment reminders (sent via Aakash SMS gateway)
- eSewa payment processing
- AI bill scanning (Gemini API)
- Syncing pending entries to the server
- Real-time notifications (Supabase Realtime)
- Login and authentication

### Why It Matters

Many areas in Nepal have unreliable or no internet connectivity. A dairy merchant on a rural route cannot depend on 4G. A kirana shop in a bazaar with thick walls may have no signal. QR Hisab's offline queue ensures every transaction is recorded regardless of connectivity, and syncs automatically when the connection returns.

The offline indicator shows a clear status: "Offline Mode — 3 items pending" (amber), "Syncing..." (blue), or "All synced" (green). Merchants never wonder whether their entry was saved.

---

## Branding & Tone

### Brand Personality

- **Practical.** This is a tool for shopkeepers, not a lifestyle app. Every feature solves a real problem.
- **Trustworthy.** Financial data must feel safe. The UI is clean, professional, and consistent.
- **Approachable.** Nepali shopkeepers may not be tech-savvy. The language is simple. The flows are short.
- **Proudly Nepali.** Built for Nepal. Uses Nepali phone formats, Nepali payment systems, Nepali SMS gateways.

### Tone of Voice

- Direct and clear. No jargon.
- Positive framing. "Balance" not "debt". "Credit" not "loan". "Ledger" not "khata" (in English UI).
- Encouraging. "Start Free — No Credit Card" not "Sign Up Now".
- Respectful. Never talks down to users.

### Design Philosophy

- **Mobile-first.** Every screen is designed for a 5-inch phone screen first.
- **Emerald green** as the primary brand color. Associated with money, trust, and growth.
- **White backgrounds** with subtle gray borders. Clean, not cluttered.
- **Rounded corners** everywhere. Friendly, not institutional.
- **Pull-to-refresh** on all list pages. Feels like a native app.
- **Glassmorphism header** (semi-transparent with blur). Modern, premium feel.
- **Realtime feedback.** Toasts, sound effects, and live updates keep users informed.

---

## Landing Page Strategy

### Hero Message

**Headline:** "Stop losing money on forgotten debts"

This directly addresses the #1 pain point. "Forgotten debts" is the emotional trigger. The solution is implied: QR Hisab prevents this.

**Subheadline:** "QR Hisab is the digital credit ledger for small shops in Nepal. Track who owes you, send payment reminders, and never lose a rupee again."

Clear, specific, benefit-driven. Mentions Nepal (target market), the category (digital credit ledger), and three concrete outcomes.

**Primary CTA:** "Start Free — No Credit Card"

Removes friction. "Free" and "No Credit Card" eliminate the two biggest objections.

**Secondary CTA:** "See How It Works"

For users who need more convincing before committing.

**Trust Signals:** Three checkmarks below CTAs:
- "Free forever for basic use"
- "Works on any phone"
- "No app download needed"

These address the three most common objections from the target audience.

### Key Selling Points (Feature Order)

1. **Digital Khata** — The core. Replace your notebook.
2. **QR Code Access** — Customers scan to record transactions.
3. **SMS Reminders** — Automatic debt collection.
4. **PIN Security** — Simple but effective protection.
5. **Live Dashboard** — Real-time business visibility.
6. **Multi-Customer** — Scales to hundreds of customers.

### Trust Elements

- **Stats bar:** "5,000+ Active merchants", "50,000+ Customers tracked", "Rs. 10Cr+ Credits managed", "4.8/5 User rating" — social proof.
- **Testimonials:** Three realistic testimonials from different business types and cities (Kathmandu, Pokhara, Chitwan). Specific numbers ("Rs. 50,000+ recovered").
- **"Made in Nepal"** footer — emotional connection with the target market.

### Physical QR Deployment

Pilot strategy involves generating print-ready PDFs of merchant QR codes for physical lamination. A shopkeeper prints, laminates, and places the QR at the counter — no app install required from customers. This bridges digital and physical, making adoption frictionless for low-tech users.

### Problem/Solution Section

"Your notebook can't do this" — two-column comparison:
- Left (red): Without QR Hisab — torn pages, forgotten debts, manual calculations, no reminders.
- Right (green): With QR Hisab — cloud-synced, instant lookup, automatic calculations, SMS reminders.

This visual contrast makes the value proposition immediately clear.

### How It Works Section

Three numbered steps on a dark background:
1. Register — Phone + PIN, under a minute
2. Add Customers — Import or add one by one
3. Start Selling — Record, accept payments, track

Simplicity is the selling point. Three steps, under 60 seconds.

### Target Audience Section

"Built For" — three use-case cards:
1. Kirana / grocery shops
2. Businesses with repeat products (dairy, water, grocery)
3. Freelancers & service providers

### Final CTA Section

Green gradient background. "Ready to go digital?" with urgency ("Join thousands"). Single CTA: "Start Using QR Hisab — It's Free".

### FAQ Ideas

- Is QR Hisab really free? — Yes, the core ledger is free forever.
- Do my customers need to install an app? — No, they scan the QR with their phone browser.
- What if I don't have internet? — The app works offline and syncs automatically.
- How do I collect payments? — Send SMS reminders, share payment links, or display your payment QR codes.
- Can I import my existing customer list? — Yes, upload a CSV or Excel file with names and phone numbers.
- What if there's a dispute? — Both you and the customer can flag entries. Disputes are resolved digitally.

---

## Competitive Advantages

1. **Customer-initiated data entry.** No other khata app requires the customer to scan and enter. This is the fundamental innovation.
2. **Two-party verification.** Every credit entry must be confirmed by both parties. This is unique in the category and builds unshakeable trust.
3. **Offline-first architecture.** Most competitors require internet. QR Hisab works without it and syncs automatically.
4. **Nepal-native.** Built for Nepali phone numbers (+977), eSewa payments, Aakash SMS, and local business patterns. Not a localized version of an Indian or global product.
5. **Free core.** The ledger is free. Revenue comes from optional SMS credits, not from locking merchants out.
6. **AI bill scanning.** Snap a photo of a paper bill to auto-fill amounts. No competitor offers this.
7. **Product Master with auto-calculation.** Unique in the category.
8. **Dual-role architecture.** One phone number can be both merchant and customer. Realistic for Nepal's interconnected retail economy.

---

## Future Roadmap

### Planned

- **eSewa production integration.** Move from UAT to live eSewa for automated SMS credit purchases.
- **Push notifications.** PWA push notifications for pending approvals, payment confirmations, and reminders.
- **Multi-language support.** Nepali language UI for users more comfortable in Nepali.
- **Auto-reminder expansion.** More reminder templates and scheduling options.

### Nice to Have

- **Email notifications.** Transaction summaries via email for merchants who prefer it.
- **Inventory management.** Barcode/QR-based stock tracking.
- **Accounting software export.** Integration with QuickBooks, Tally, or similar.
- **Analytics dashboard.** Advanced charts and trends beyond current reports.
- **Customer mobile app.** A dedicated customer-facing PWA with enhanced features.

### Long-Term Vision

- **Payment gateway integration.** Direct in-app payments via eSewa, Khalti, IME Pay.
- **Credit scoring.** AI-powered trust scoring based on payment history.
- **Multi-location support.** Franchise or chain store management.
- **API for third parties.** Allow developers to build integrations on top of QR Hisab.
- **B2B ledger.** Micro-loans and trade credit between businesses.

---

## Product Principles

These rules should never be broken during future development:

1. **The core ledger must always be free.** Revenue features enhance the experience but never gate the basic functionality.
2. **Every credit entry must have two-party consent.** The merchant creates it, the customer confirms it. No exceptions.
3. **Works offline.** Every new feature must degrade gracefully without internet. If it requires internet, it must queue and sync.
4. **No app download required.** The PWA must work in a browser. Installation is optional, not required.
5. **Phone number is the identity.** No email, no username. Phone number + PIN is the authentication model.
6. **Nepal-first.** Features are designed for Nepal's market, payment systems, and connectivity conditions.
7. **Customer data entry over merchant data entry.** Where possible, shift data entry to the customer via QR scanning.
8. **Positive language.** Never use shame-inducing terms like "debt", "udharo", "default". Use "balance", "credit", "ledger".
9. **Mobile-first design.** Every screen must work perfectly on a 5-inch phone screen.
10. **Both parties see the same data.** There is no "merchant view" of a transaction that differs from the "customer view". Transparency is non-negotiable.

---

## Documentation References

For technical details, refer to:

| Topic | Document |
|-------|----------|
| System architecture, auth flow, middleware | [`ARCHITECTURE.md`](../ARCHITECTURE.md) |
| Database schema (16 tables, functions, triggers) | [`docs/database_schema.md`](database_schema.md) |
| Stack, security, dependencies | [`docs/technical_specifications.md`](technical_specifications.md) |
| Business logic, edge cases, validation | [`docs/business_logic.md`](business_logic.md) |
| Feature history and changes | [`CHANGELOG.md`](../CHANGELOG.md) |
| Current pending work | [`TODO_LIST.md`](../TODO_LIST.md) |
| Quick start and project overview | [`README.md`](../README.md) |
| Historical audit of render loop fix | [`docs/infinite-render-loop-audit.md`](infinite-render-loop-audit.md) |
| AI coding assistant instructions | [`docs/ai_instructions_prompt.md`](ai_instructions_prompt.md) |
| Production readiness status | [`docs/PROJECT_STATUS.md`](PROJECT_STATUS.md) |
