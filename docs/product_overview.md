# Product Overview: QR Hisab (Sajilo Khata)

## 1. Core Philosophy
QR Hisab is a mobile-first web application designed to digitize credit (Udharo) management for small retail/grocery shops (Kirana) with product-based tracking for dairy, water, and other businesses. Unlike traditional accounting apps that burden the shopkeeper with data entry, this app shifts the data input responsibility to the customer, reducing merchant friction by 80%.

## 2. Core Features & System Logic
- **Hybrid Online/Offline Architecture:**
  - **Shop Mode (Kirana):** Supports offline-first with online sync. The customer scans the shop's QR code, enters the transaction details, and the merchant approves it. Offline entries are stored locally and synced automatically when connectivity returns. If the customer is offline, the system triggers the **"Reverse QR"** flow (generating a data-embedded QR on the customer's phone, which the merchant scans to queue locally).
  - **Product-Based Entry (Dairy/Water):** When a merchant has products configured, the entry form shows a product picker. Selecting a product auto-fills rate, quantity, and unit. Full offline support via IndexedDB — items sync with the credit log.
- **Frictionless Customer Onboarding:** Customers register with a phone number and OTP, then set a 4-digit PIN. No complex registration forms. Subsequent logins use phone + PIN.
- **Multi-Shop Support (Many-to-Many Ledger):** A single customer can maintain credit accounts across multiple merchants (e.g., grocery, dairy, meat shop). Customers see a unified dashboard showing their total liabilities, while strict data isolation prevents merchants from seeing any external credit history.
- **Dual-Role Architecture:** A user can be both a merchant and a customer with the same phone number. They share a single UUID across both roles, enabling seamless switching between merchant and customer views via the RoleSwitcher component. The OtherRolePrompt component encourages single-role users to register for the second role.
- **Dual Unit Matrix:** Kirana logs transactions directly in monetary value (NPR), while product-enabled merchants log items using quantity metrics (Liters, Jars, Kgs) with auto-calculated totals.
- **Multi-Device Merchant Login:** Merchant accounts support concurrent active sessions, allowing family members or employees to view and approve entries simultaneously from different devices.

## 3. Authentication
- **Phone + OTP + PIN hybrid flow:** Users enter phone, receive OTP for verification, then set/use a 4-digit PIN for subsequent logins.
- **Role selection:** New users choose Merchant or Customer during registration. Existing multi-role users choose which view to enter.
- **Force logout:** Admins can revoke all sessions for a compromised account via the `force_logout_at` kill-switch.
- **Session persistence:** 30-day HTTP-only session cookies with HMAC-SHA256 signing.

## 4. Branding & UX Strategy
- **Positive Terminology:** Avoid socially discouraging terms like "Udharo" or "Debt" in the UI. Use affirmative language such as "QR Hisab", "Digital Diary", or "Account Statement".
- **Physical QR Deployment:** For the pilot phase, the platform will generate high-quality print-ready PDFs of static QRs to be physically laminated and installed at the initial 5–10 test shops.
