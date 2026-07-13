# Product Overview: QR Hisab (Digital Credit Ledger & Delivery Diary)

## 1. Core Philosophy
QR Hisab is a mobile-first web application designed to digitize credit (Udharo) management for small retail/grocery shops (Kirana) and automate daily milk/water delivery tracking. Unlike traditional accounting apps that burden the shopkeeper with data entry, this app shifts the data input responsibility to the customer, reducing merchant friction by 80%.

## 2. Core Features & System Logic
- **Hybrid Online/Offline Architecture:**
  - **Shop Mode (Kirana):** Online-only by default. The customer scans the shop's QR code, enters the transaction details, and the merchant approves it. If the customer is offline, the system triggers the **"Reverse QR"** flow (generating a data-embedded QR on the customer's phone, which the merchant scans to queue locally).
  - **Delivery Mode (Dairy/Water):** Full offline support using IndexedDB. Delivery personnel can log drops at the customer's doorstep without internet access. Data syncs automatically once a connection is detected.
- **Frictionless Customer Onboarding:** No tedious registration or passwords for customers. On the first scan, they enter their phone number, which is saved locally via `LocalStorage`. Subsequent scans instantly recognize the customer.
- **Multi-Shop Support (Many-to-Many Ledger):** A single customer can maintain credit accounts across multiple merchants (e.g., grocery, dairy, meat shop). Customers see a unified dashboard showing their total liabilities, while strict data isolation prevents merchants from seeing any external credit history.
- **Dual Unit Matrix:** Kirana logs transactions directly in monetary value (NPR), while Delivery mode logs items using quantity metrics (Liters, Jars, Kgs) based on pre-configured base rates per customer.
- **Multi-Device Merchant Login:** Merchant accounts support concurrent active sessions, allowing family members or employees to view and approve entries simultaneously from different devices.

## 3. Branding & UX Strategy
- **Positive Terminology:** Avoid socially discouraging terms like "Udharo" or "Debt" in the UI. Use affirmative language such as "QR Hisab", "Digital Diary", or "Account Statement".
- **Physical QR Deployment:** For the pilot phase, the platform will generate high-quality print-ready PDFs of static QRs to be physically laminated and installed at the initial 5–10 test shops.