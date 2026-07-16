"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const smsAdded = searchParams.get("sms");
  const errorMsg = searchParams.get("error");

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-sm border border-gray-50 p-8 text-center">
        {status === "completed" ? (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-[var(--color-text)] mb-2">Payment Successful!</h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-1">
              {smsAdded ? `${smsAdded} SMS credits` : "Credits"} have been added to your account.
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mb-6">
              You can now send payment reminders to your customers.
            </p>
            <Link
              href="/merchant/billing"
              className="inline-block w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold text-center active:scale-[0.98] transition-transform"
            >
              Go to Billing
            </Link>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-[var(--color-text)] mb-2">Payment Failed</h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-1">
              {errorMsg || "The payment could not be completed."}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mb-6">Please try again.</p>
            <Link
              href="/merchant/billing"
              className="inline-block w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold text-center active:scale-[0.98] transition-transform"
            >
              Try Again
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
