import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — QR Hisab",
  description: "Terms of Service for QR Hisab — digital khata for Nepali shops.",
};

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-3xl font-extrabold text-[var(--color-text)]">Terms of Service</h1>
        <p className="mb-8 text-sm text-[var(--color-text-muted)]">Effective date: August 2026</p>

        <div className="space-y-8 text-[var(--color-text)] leading-relaxed">
          <section>
            <h2 className="mb-3 text-xl font-bold">1. Acceptance</h2>
            <p>By using QR Hisab, you agree to these terms. If you do not agree, do not use the service.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">2. Service description</h2>
            <p>QR Hisab is a digital khata (credit ledger) for Nepali shops. It allows merchants to record customer credit, track expenses, and send SMS reminders. Customers can view their balances by scanning a shop&apos;s QR code.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">3. Accounts</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Merchant accounts require a valid phone number and OTP verification.</li>
              <li>Customer access is secured with a PIN you set.</li>
              <li>You are responsible for keeping your phone and PIN secure.</li>
              <li>One phone number can have both merchant and customer roles.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">4. Your data</h2>
            <p>You own your khata data. We store it securely and do not share it with third parties. See our <a href="/privacy" className="text-[var(--color-primary)] underline">Privacy Policy</a> for details.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">5. SMS credits</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>SMS credits are purchased in packages (Rs 101 / 201 / 501).</li>
              <li>Credits are used to send payment reminder SMS to customers.</li>
              <li>Credits are non-transferable and non-refundable once used.</li>
              <li>See <a href="/refund" className="text-[var(--color-primary)] underline">Refund Policy</a> for unused credit refunds.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">6. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Use the service for illegal purposes.</li>
              <li>Attempt to access other users&apos; data.</li>
              <li>Abuse the SMS reminder system (spam, harassment).</li>
              <li>Reverse-engineer or exploit the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">7. Limitation of liability</h2>
            <p>QR Hisab is provided &quot;as is.&quot; We are not liable for financial losses arising from use of the ledger. The khata is a record-keeping tool — it does not constitute financial advice.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">8. Changes</h2>
            <p>We may update these terms. Continued use after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">9. Contact</h2>
            <p>Questions? Reach us via WhatsApp at +977-9763658505.</p>
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
