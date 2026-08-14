import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — QR Hisab",
  description: "Privacy Policy for QR Hisab — digital khata for Nepali shops.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-3xl font-extrabold text-[var(--color-text)]">Privacy Policy</h1>
        <p className="mb-8 text-sm text-[var(--color-text-muted)]">Effective date: August 2026</p>

        <div className="space-y-8 text-[var(--color-text)] leading-relaxed">
          <section>
            <h2 className="mb-3 text-xl font-bold">1. What we collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Phone number</strong> — used for OTP login and merchant/customer identity.</li>
              <li><strong>Shop name &amp; profile</strong> — displayed on your QR page and dashboard.</li>
              <li><strong>Transaction entries</strong> — credit amounts, products, dates, and approval status you record.</li>
              <li><strong>SMS credit purchases</strong> — payment records via eSewa or bank transfer.</li>
              <li><strong>PIN</strong> — stored as a salted hash; used to lock customer access.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">2. How we use it</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide the khata (credit ledger) service.</li>
              <li>To authenticate you via OTP and PIN.</li>
              <li>To send SMS payment reminders to your customers (when you purchase SMS credits).</li>
              <li>To prevent fraud and enforce access rules (RLS — row-level security).</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">3. What we don&apos;t do</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>We do not sell your data to third parties.</li>
              <li>We do not use tracking cookies or analytics on the landing page.</li>
              <li>We do not share your transaction data with other merchants or customers.</li>
              <li>We do not run targeted advertising.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">4. Data security</h2>
            <p className="mb-2">All data is encrypted in transit (HTTPS). Database access is restricted by row-level security (RLS) — you can only see your own khata.</p>
            <p>Sessions are cryptographically signed. If your phone is lost, sessions can be force-logged-out.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">5. Data retention</h2>
            <p>Your transaction data is retained as long as your account is active. You may request deletion of your account and all associated data by contacting support.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">6. SMS credits</h2>
            <p>SMS reminder credits are purchased via eSewa or bank transfer. Credits are non-transferable. See the <a href="/refund" className="text-[var(--color-primary)] underline">Refund Policy</a> for credit refund terms.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">7. Changes</h2>
            <p>We may update this policy. Continued use of QR Hisab after changes constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">8. Contact</h2>
            <p>For privacy-related questions, reach us via WhatsApp at +977-9763658505.</p>
          </section>
        </div>

        <div className="mt-12 text-center">
          <a href="/" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
            &larr; Back to home
          </a>
        </div>
      </div>
    </div>
  );
}
