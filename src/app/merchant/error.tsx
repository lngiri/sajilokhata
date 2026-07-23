"use client";

import { useEffect } from "react";

export default function MerchantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error("Merchant error:", error); }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6">
      <div className="w-16 h-16 mb-4 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-[var(--color-text-muted)] text-center mb-6">
        An unexpected error occurred. Please try again.
      </p>
      <div className="flex gap-3">
        <a
          href="/"
          className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-medium"
        >
          Home
        </a>
        <button
          onClick={reset}
          className="px-6 py-3 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-medium active:scale-[0.98] transition-transform"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
