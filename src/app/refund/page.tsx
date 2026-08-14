import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy — QR Hisab",
  description: "Refund Policy for QR Hisab SMS credits.",
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-3xl font-extrabold text-[var(--color-text)]">Refund Policy</h1>
        <p className="mb-8 text-sm text-[var(--color-text-muted)]">Effective date: August 2026</p>

        <div className="space-y-8 text-[var(--color-text)] leading-relaxed">
          <section>
            <h2 className="mb-3 text-xl font-bold">1. Core khata</h2>
            <p>The core khata (credit ledger) is <strong>free</strong>. There is nothing to refund for the free tier.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">2. SMS credit packages</h2>
            <p>SMS credits are sold in the following packages:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Rs 101 — 50 SMS credits</li>
              <li>Rs 201 — 110 SMS credits (popular)</li>
              <li>Rs 501 — 300 SMS credits</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">3. Refund eligibility</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Unused credits:</strong> If you have not sent any SMS reminders after purchase, you may request a full refund within 7 days of purchase.</li>
              <li><strong>Partially used credits:</strong> Refunds are not available for partially used packages.</li>
              <li><strong>Used credits:</strong> Once SMS reminders have been sent, credits cannot be refunded.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">4. How to request a refund</h2>
            <p>Contact us via WhatsApp at +977-9763658505 with your purchase details. We will review your request within 3 business days.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">5. Payment gateway</h2>
            <p>The payment gateway is currently in test mode. During test mode, no real charges are made. When the gateway goes live, this refund policy will apply to real purchases.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">6. Changes</h2>
            <p>We may update this policy. The policy in effect at the time of your purchase applies to your refund request.</p>
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
