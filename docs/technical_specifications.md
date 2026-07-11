# Technical Specifications & Architecture

## 1. Technology Stack
- **Frontend & Backend:** Next.js (App Router, Server Actions)
- **Styling:** Tailwind CSS (Strictly Mobile-First Layouts)
- **Database & Authentication:** Supabase (PostgreSQL with Row Level Security)
- **Offline Engines:** Progressive Web App (PWA) configuration with Workbox and IndexedDB (`idb` library)
- **QR Operations:** `qrcode.react` for dynamic client-side generation, `html5-qrcode` for camera stream parsing

## 2. Security, Integrity & KYC
- **OTP Verification:** Strict 2-Factor OTP verification via SMS/WhatsApp when a customer requests to view their comprehensive financial statements.
- **Immutable Audit Logging:** Every submitted log captures the user's IP address, device metadata, and a cryptographic timestamp to prevent "repudiation" or disputes over entry origins.
- **Data Safeguards:** Automated daily snapshots on Supabase.
- **Portability:** Merchants must have a one-click action to export their ledger accounts to PDF or Excel formats.

## 3. Communication Strategy
- **Cost Minimization:** To eliminate high SMS gateway costs during the boot phase, the system will rely on **In-App Push Notifications** and free/low-cost **WhatsApp/Viber Webhooks** for transactional updates.