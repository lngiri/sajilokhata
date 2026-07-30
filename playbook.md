# Landing Page Design Playbook — QR Hisab (Sajilo Khata)

This document gives a landing page designer everything needed to build, write, and iterate the public site. It is the single source of truth for brand, messaging, audience, features, and page architecture.

---

## 1. Brand Foundation

### Brand Personality

| Trait | Meaning for Design |
|-------|-------------------|
| **Practical** | Every element must signal utility. No decoration for decoration's sake. |
| **Trustworthy** | Financial data feels safe. Clean layout, consistent spacing, professional typography. |
| **Approachable** | The audience may not be tech-savvy. Simple language, short flows, friendly visuals. |
| **Proudly Nepali** | Built for Nepal. Use Nepali phone formats, reference local payment systems, show local context. |

### Brand Name

- **Product name:** QR Hisab
- **Nepali name (secondary):** सजिलो खाता
- **Tagline:** "The digital credit ledger for small shops in Nepal"
- **Short descriptor:** "Track who owes you, send reminders, never lose a rupee."

### Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Emerald Green (Primary) | `#10B981` | Primary buttons, key accents, success states |
| Dark Green (Primary dark) | `#059669` | Hover states, gradient ends |
| Deep Green (Primary deeper) | `#047857` | Active/pressed states |
| White | `#FFFFFF` | Page backgrounds, card backgrounds |
| Gray 50 | `#F9FAFB` | Section background alternates |
| Gray 100 | `#F3F4F6` | Card backgrounds on alt sections |
| Gray 200 | `#E5E7EB` | Borders, dividers |
| Gray 500 | `#6B7280` | Body text secondary |
| Gray 700 | `#374151` | Body text primary |
| Gray 900 | `#111827` | Headlines |
| Red (problem side) | `#EF4444` | "Without QR Hisab" comparison column |
| Amber (warning) | `#F59E0B` | Offline mode indicator, pending states |
| Blue (info) | `#3B82F6` | Syncing indicator, links |

### Typography

- **Headlines:** Inter Bold / ExtraBold (sans-serif)
- **Body:** Inter Regular / Medium (sans-serif)
- **Monospace (code/numbers):** JetBrains Mono (optional, for financial figures)
- **Scale:** Use a 4-point grid. Headlines: 36/30/24/20px. Body: 16/14/12px.
- **Line height:** Headlines 1.2, Body 1.5

### Tone of Voice

- Direct and clear. No jargon.
- Positive framing: "Balance" not "debt", "Credit" not "loan", "Ledger" not "khata" (in English UI).
- Encouraging: "Start Free — No Credit Card" not "Sign Up Now".
- Respectful. Never talks down to the user.
- Short sentences. Short paragraphs.

---

## 2. Target Audience

### Primary: Small Shop Owners (Merchants)

**Who:** Kirana (grocery), dairy, meat, hardware, pharmacy, restaurant owners in Nepal. 20–200+ credit customers. Moderate smartphone literacy.

**What they care about:**
- "I lose money because customers forget what they owe."
- "I waste hours adding up my notebook every month."
- "I have no way to remind customers to pay without calling them."
- "Customers dispute amounts because my handwriting is bad."

**What they don't care about:**
- Complex accounting software features
- Inventory management
- Email notifications
- Fancy animations

### Secondary: Customers (End Users)

**Who:** People who buy from small shops on credit. Daily (milk, rice) or monthly (hardware, supplies). Any phone, any connectivity.

**What they care about:**
- "I don't know exactly how much I owe at each shop."
- "The shopkeeper's record is the only record. I can't verify it."
- "I need proof when I pay."

### Dual-Role Users

Many Nepali shopkeepers are also customers at other shops. A single person may need both merchant and customer views.

### Key Insight for Design

**The merchant is the decision-maker.** The landing page must convince the shopkeeper to sign up. Customer experience is secondary for the landing page — it can be described but doesn't need to be the hero.

---

## 3. Value Proposition & Messaging Hierarchy

### Level 1: The Single Message (Hero)

> **"Stop losing money on forgotten debts."**

The #1 emotional trigger. Every shopkeeper has lost money because a customer "forgot" or the notebook entry was illegible.

### Level 2: The Solution Statement (Subheadline)

> **"QR Hisab is the digital credit ledger for small shops in Nepal. Track who owes you, send payment reminders, and never lose a rupee again."**

Three concrete outcomes. Clear category definition. Local market reference.

### Level 3: The Proof Points (Trust Signals)

> - ✅ Free forever for basic use
> - ✅ Works on any phone
> - ✅ No app download needed

Three objections killed instantly.

### Level 4: The Feature Benefits (How It Works)

Each feature is framed as a **problem → solution** pair. Never list features without the problem they solve.

| If merchant thinks... | We say... |
|----------------------|-----------|
| "My notebook gets lost" | Cloud-synced digital ledger — never lose a record |
| "Customers forget what they owe" | Instant balance lookup + SMS reminders |
| "I spend hours calculating" | Automatic balance computation |
| "Customers dispute amounts" | Both parties see & confirm every entry |
| "I can't track who hasn't paid" | Dashboard with outstanding totals per customer |

### Level 5: The Social Proof (Stats & Testimonials)

Hard numbers and real-sounding stories from specific Nepali locations.

---

## 4. Feature Catalog

Organized by landing page priority, not technical category.

### Tier 1: Hero Features (Must appear above the fold)

| Feature | One-liner for landing page |
|---------|---------------------------|
| Digital Khata | Replace your paper notebook with a cloud-synced digital ledger. |
| QR Code Access | Customers scan your shop QR to record transactions — no data entry for you. |
| SMS Reminders | Automatic payment reminders. Customers get SMS. You get paid. |
| Live Dashboard | See outstanding balances, today's sales, and pending approvals at a glance. |

### Tier 2: Differentiator Features (Scroll-depth section)

| Feature | One-liner |
|---------|-----------|
| Two-Party Verification | Every credit entry must be confirmed by both you and the customer. No more disputes. |
| Works Offline | Poor internet? No problem. Transactions queue locally and sync automatically. |
| PIN Security | Simple 4-digit PIN keeps your account safe. No complicated passwords. |
| Multi-Customer | Manage 20, 50, or 200+ customers from one phone. |

### Tier 3: Advanced Features (Lower section or "More" section)

| Feature | One-liner |
|---------|-----------|
| AI Bill Scan | Snap a photo of a paper bill. AI fills in the amount automatically. |
| Cash Sales Ledger | Track cash transactions too — get the complete picture. |
| Payment Vouchers | Customers upload payment screenshots as proof. You approve. |
| Bulk Import | Switch from paper to digital in minutes. Upload your customer list. |
| CSV / JSON Export | Download your data for accounting or tax purposes. |

### Tier 4: Social Proof Features (Show, don't tell)

| Asset | Content |
|-------|---------|
| Merchant count | "5,000+ Active Merchants" |
| Customers tracked | "50,000+ Customers Tracked" |
| Credits managed | "Rs. 10Cr+ Credits Managed" |
| Rating | "4.8/5 User Rating" |
| Testimonial 1 | "I recovered Rs. 50,000+ in unpaid debts within the first month." — Rajesh, Kirana Shop, Kathmandu |
| Testimonial 2 | "My customers love scanning the QR. They can see exactly what they owe." — Sunita, Dairy Shop, Pokhara |
| Testimonial 3 | "No more paper notebooks getting wet or torn. Everything is on my phone." — Gopal, Hardware Store, Chitwan |

---

## 5. Landing Page Section Blueprint

### Section 1: Hero

- **Background:** Clean white or very light gray. Full-width.
- **Headline:** "Stop losing money on forgotten debts"
- **Subheadline:** "QR Hisab is the digital credit ledger for small shops in Nepal. Track who owes you, send payment reminders, and never lose a rupee again."
- **Primary CTA:** "Start Free — No Credit Card" (emerald green button, large)
- **Secondary CTA:** "See How It Works" (outline button, links to #how-it-works)
- **Trust signals:** 3 checkmarks below CTAs: "Free forever for basic use" / "Works on any phone" / "No app download needed"
- **Visual:** Right side — illustration of a shopkeeper holding a phone showing a QR code, or a mockup of the dashboard. Should feel warm, local (Nepali shop setting), and modern.
- **Animation:** Subtle. Floating QR code graphic, or gentle pulse on the CTA.

### Section 2: Problem/Solution ("Your notebook can't do this")

- **Background:** White
- **Layout:** Two-column comparison
- **Left column (red tint):** "Without QR Hisab"
  - Torn notebook pages icon
  - "Forgotten debts"
  - "Manual calculations"
  - "No reminders"
  - "One-sided records"
- **Right column (green tint):** "With QR Hisab"
  - Cloud icon
  - "Cloud-synced & safe"
  - "Auto-calculated balances"
  - "SMS reminders"
  - "Two-party verification"
- **Visual style:** Cards with icons. The contrast should be immediately visible.

### Section 3: Stats Bar (optional, could merge into hero)

- **Background:** Emerald green gradient
- **4 stat blocks in a row (2×2 on mobile):**
  - "5,000+" / "Active Merchants"
  - "50,000+" / "Customers Tracked"
  - "Rs. 10Cr+" / "Credits Managed"
  - "4.8/5" / "User Rating"

### Section 4: How It Works (#how-it-works)

- **Background:** Dark (Gray 900) or emerald gradient
- **Headline:** "How QR Hisab Works"
- **Subheadline:** "Three simple steps. Under 60 seconds to start."
- **3 numbered steps (horizontal on desktop, vertical on mobile):**
  1. **Register** — Enter your phone number, set a 4-digit PIN. Done.
  2. **Print Your QR** — Generate your shop QR code. Print it. Keep it at the counter.
  3. **Start Tracking** — Customers scan and enter transactions. You approve. Balances update automatically.
- **Visual:** Each step gets an icon + short description. Could have a phone mockup showing each step.

### Section 5: Features Grid

- **Background:** Gray 50
- **Headline:** "Everything you need to manage credit"
- **Subheadline:** "Digital khata, QR access, SMS reminders, live dashboard — all in one app."
- **6 cards in a 3×2 grid:**
  1. 📱 Digital Khata — Replace your notebook
  2. 📷 QR Code Access — Customers scan to record
  3. 📨 SMS Reminders — Automatic debt collection
  4. 🔒 PIN Security — Simple but effective
  5. 📊 Live Dashboard — Real-time business view
  6. 👥 Multi-Customer — Scales to hundreds
- **Each card:** Icon (top), title, 1-sentence description.
- **Hover:** Subtle lift shadow.

### Section 6: Target Audience ("Built For")

- **Background:** White
- **Headline:** "Built For Shops Like Yours"
- **3 use-case cards:**
  1. **Kirana / Grocery** — Daily credit cycles, dozens of customers
  2. **Dairy & Repeat Products** — Track quantity (liters, jars, kgs) with auto-calculation
  3. **Hardware & Pharmacy** — High-value, low-frequency credit with full audit trail
- **Visual:** Icons representing each shop type. Clean, not cartoonish.

### Section 7: Testimonials

- **Background:** Gray 50
- **Headline:** "Trusted by Shopkeepers Across Nepal"
- **3 testimonial cards (carousel or grid):**
  - "I recovered Rs. 50,000+ in unpaid debts within the first month. The SMS reminders alone are worth it." — **Rajesh**, Kirana Shop, Kathmandu
  - "My customers love scanning the QR. They can see exactly what they owe. No more 'I don't remember' excuses." — **Sunita**, Dairy Shop, Pokhara
  - "No more paper notebooks getting wet or torn. Everything is on my phone. I can check my outstanding from home." — **Gopal**, Hardware Store, Chitwan

### Section 8: FAQ

- **Background:** White
- **Headline:** "Common Questions"
- **Accordion-style FAQ items:**

| Question | Answer |
|----------|--------|
| Is QR Hisab really free? | Yes. The core ledger is free forever. You only pay if you choose to send SMS reminders (prepaid credits starting at Rs. 101). |
| Do my customers need to install an app? | No. They scan your QR code with their phone camera. It opens in their browser. No download, no registration required. |
| What if I don't have internet? | QR Hisab works offline. Transactions are stored on your phone and sync automatically when you're back online. |
| How do I collect payments? | Send SMS reminders, share a payment link via WhatsApp, or display your eSewa/bank QR code. Customers can upload payment screenshots as proof. |
| Can I import my existing customers? | Yes. Upload a CSV or Excel file with names and phone numbers. We send them an SMS notification welcoming them to QR Hisab. |
| What if someone disputes a transaction? | Both you and the customer can flag entries. Disputed entries are held separately until resolved. Everything is transparent. |

### Section 9: Final CTA

- **Background:** Emerald green gradient
- **Headline:** "Ready to go digital?"
- **Subheadline:** "Join thousands of shopkeepers who never lose track of their credit."
- **CTA:** "Start Using QR Hisab — It's Free" (white button on green background)
- **Small text below:** "No credit card. No download. No risk."

### Footer

- Links: Home / How It Works / Privacy Policy / Terms of Service
- Contact: Email or phone for support
- "Made in 🇳🇵 Nepal" badge
- Copyright line

---

## 6. Design System Guidelines

### Layout

- **Max content width:** 1200px, centered
- **Grid:** 12-column grid on desktop, 4-column on tablet, 2-column on mobile
- **Section padding:** 96px top/bottom on desktop, 64px on tablet, 48px on mobile
- **Border radius:** 12px for cards, 8px for buttons, 6px for inputs
- **Shadows:** `0 1px 3px rgba(0,0,0,0.1)` for cards, `0 4px 6px rgba(0,0,0,0.1)` for hover

### Navigation / Header

- **Style:** Glassmorphism — semi-transparent white background (`rgba(255,255,255,0.8)`) with backdrop blur (`blur(12px)`)
- **Sticky:** Fixed to top on scroll
- **Items (left to right):** Logo (QR Hisab) | How It Works | Features | FAQ | **Start Free** (CTA button)
- **Mobile:** Hamburger menu with same items

### Buttons

| Type | Style | Usage |
|------|-------|-------|
| Primary | Emerald green bg, white text, 8px radius, 16px/20px padding | Main CTAs |
| Secondary | White bg, emerald border, emerald text | "See How It Works", secondary actions |
| Ghost | No bg, gray text | Links, less important actions |

### Imagery Guidelines

- **Photography style:** Warm, natural light. Real Nepali shops (kirana, dairy, hardware). Not staged studio shots.
- **Illustration style:** Simple, flat vector with emerald accents. Friendly, not corporate.
- **Icon style:** Outline icons, 24px default, consistent stroke width (1.5px or 2px). Use Lucide or Heroicons set.
- **Avoid:** Stock photos of suit-clad professionals, Western shop settings, abstract 3D renders.

### Animations

- **Scroll reveals:** Elements fade in + translate up (20px) on scroll into view. Stagger children by 100ms.
- **CTA pulse:** Subtle scale pulse on the primary CTA every 4 seconds to draw attention.
- **Hover:** Card lift (translateY -4px + shadow increase), button darken.
- **Mobile:** No parallax or heavy animations. Keep it performant.
- **Duration:** 300ms for most transitions. 600ms for scroll reveals.

### Mobile First

- All sections must be readable and functional at 375px width.
- Touch targets: minimum 44×44px.
- No horizontal scroll. No elements that overflow the viewport.

---

## 7. Copy Guidelines

### Headlines — Use These Exact Phrasings

| Section | Headline |
|---------|----------|
| Hero | "Stop losing money on forgotten debts" |
| Problem/Solution | "Your notebook can't do this" |
| How It Works | "How QR Hisab Works" |
| Features | "Everything you need to manage credit" |
| Target Audience | "Built For Shops Like Yours" |
| Testimonials | "Trusted by Shopkeepers Across Nepal" |
| FAQ | "Common Questions" |
| Final CTA | "Ready to go digital?" |

### CTA Copy — Use These Exact Phrasings

| Context | CTA Text |
|---------|----------|
| Hero primary | "Start Free — No Credit Card" |
| Hero secondary | "See How It Works" |
| Final CTA primary | "Start Using QR Hisab — It's Free" |

### Never Use

- "Debt" / "Udharo" / "Default" — Use "Balance" / "Credit" / "Outstanding"
- "Sign Up Now" — Too generic. Use "Start Free"
- "Download" — There is no download. Use "Open" or "Start"
- Jargon: "Two-factor authentication" → "PIN Security". "Queue" → "Works offline".

---

## 8. User Flow (Landing Page → Activation)

```
Landing Page
  │
  ├── Tap "Start Free"
  │     └── Phone number input screen
  │           └── OTP verification
  │                 └── Role selection (Merchant / Customer)
  │                       └── PIN setup
  │                             └── Dashboard (onboarding state)
  │
  └── Tap "See How It Works"
        └── Scroll to #how-it-works section
```

**Key UX requirement:** The first-time merchant dashboard should show a clear "next step" — either "Print Your QR Code" or "Add Your First Customer". The landing page designer should communicate this handoff visually (e.g., a screenshot of the onboarding dashboard).

---

## 9. Competitive Positioning

### How to Position vs. Alternatives

| Instead of saying... | Say... |
|----------------------|--------|
| "Better than paper notebook" | "Your notebook can't do this" (visual comparison) |
| "Unlike other khata apps..." | Don't name competitors. Focus on your differentiators. |
| "We have AI features" | "Snap a photo. AI fills the amount." (benefit, not feature) |

### Key Differentiators to Feature Prominently

1. **Customer scans the QR** — not the merchant. This is the fundamental innovation.
2. **Two-party verification** — unique in the category. Builds trust.
3. **Works offline** — most competitors require internet.
4. **Free core** — no subscription, no hidden fees.
5. **Nepal-native** — built for +977 phones, eSewa, Aakash SMS, Nepali business patterns.
6. **Dual-role** — one phone number can be both merchant and customer.

---

## 10. Trust & Security (For Testimonials / Social Proof Section)

Messages to weave into the page:

- **"Free forever for basic use."** — No subscription, no credit card. Revenue comes from optional SMS credits.
- **"Both parties see the same data."** — The merchant and customer share one ledger. No secrets.
- **"Every transaction needs two confirmations."** — No one can unilaterally change the record.
- **"PIN-protected accounts."** — Simple 4-digit PIN. No complicated passwords.
- **"Offline-safe."** — Even without internet, transactions are recorded and sync later.
- **"Made in Nepal."** — Built by and for Nepali businesses.

---

## 11. Technical Constraints (Must-Know for Design)

| Constraint | Design Implication |
|-----------|-------------------|
| PWA, not native app | No "Download on App Store" badges. Primary action is "Start" (web-based) or "Add to Home Screen". Can show a small "Install App" prompt for returning users. |
| Phone number = identity | No email input fields on landing page. The signup flow starts with phone only. |
| Offline-first | The landing page should not imply constant internet is required. |
| Mobile-first usage | The landing page hero should show a phone prominently, not a desktop. |

---

## 12. Success Metrics (How We'll Know the Page Works)

| Metric | Target |
|--------|--------|
| Hero CTA click rate | > 15% of visitors |
| Scroll depth to Features section | > 50% of visitors |
| Time on page | > 45 seconds |
| Bounce rate | < 55% |
| Signup completion rate (CTA → dashboard) | > 20% of clickers |
| "See How It Works" click rate | > 5% of visitors |

---

## Appendix: Visual Reference Scenarios

### Hero Visual Direction

A realistic illustration or photo of a small kirana shop in Nepal. The shopkeeper holds a phone showing the QR Hisab QR code. A customer is scanning it with their own phone. Warm lighting. Simple background. The focus is on the interaction between the two people and the phone screens.

### Feature Icon Ideas

| Feature | Icon Concept |
|---------|-------------|
| Digital Khata | Notebook with digital overlay / cloud |
| QR Access | QR code with scan line |
| SMS Reminders | Chat bubble with rupee symbol |
| PIN Security | Shield with lock |
| Live Dashboard | Bar chart on phone screen |
| Multi-Customer | People icon with + badge |

### Color Use Cases

- **Emerald green:** Primary CTA buttons, active states, success indicators, gradient backgrounds for CTA sections
- **Red:** Only in the problem/comparison section to show pain
- **Amber:** Only if needed for offline mode illustration
- **Gray:** Body text, backgrounds, borders, inactive states
- **White:** Card backgrounds, page backgrounds
- **Dark:** Headlines, footer backgrounds, dark section backgrounds (How It Works section)
