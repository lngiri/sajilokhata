"use client";

import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [selectedRole, setSelectedRole] = useState<
    "merchant" | "customer" | "delivery" | null
  >(null);

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6 py-12">
      {/* Logo & Branding */}
      <div className="mb-8 text-center animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center shadow-lg">
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold text-[var(--color-primary)]">
          Sajilo Khata
        </h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Digital Credit Ledger & Delivery Diary
        </p>
      </div>

      {/* Role Selection */}
      <div className="w-full space-y-3 animate-fade-in">
        <Link
          href="/merchant/dashboard"
          className="flex items-center w-full p-5 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-[var(--color-primary)] transition-all active:scale-[0.98]"
          onClick={() => setSelectedRole("merchant")}
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mr-4">
            <svg
              className="w-6 h-6 text-[var(--color-primary)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--color-text)]">
              Shop Owner
            </h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Manage credit entries & approvals
            </p>
          </div>
          <svg
            className="w-5 h-5 ml-auto text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>

        <Link
          href="/customer/dashboard"
          className="flex items-center w-full p-5 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-[var(--color-accent)] transition-all active:scale-[0.98]"
          onClick={() => setSelectedRole("customer")}
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mr-4">
            <svg
              className="w-6 h-6 text-[var(--color-accent)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--color-text)]">
              Customer
            </h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Submit credit requests & manage entries
            </p>
          </div>
          <svg
            className="w-5 h-5 ml-auto text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>

        <Link
          href="/delivery"
          className="flex items-center w-full p-5 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-400 transition-all active:scale-[0.98]"
          onClick={() => setSelectedRole("delivery")}
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mr-4">
            <svg
              className="w-6 h-6 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h17.25m-17.25 0V5.625A2.25 2.25 0 015.625 3.375h2.25a.75.75 0 00.75-.75V3.375m4.5 0a.75.75 0 00.75.75h2.25A2.25 2.25 0 0117.25 5.625v5.625m0 0H3.375"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--color-text)]">
              Delivery Agent
            </h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Log doorstep deliveries (offline ready)
            </p>
          </div>
          <svg
            className="w-5 h-5 ml-auto text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>

      {/* Footer */}
      <p className="mt-10 text-xs text-[var(--color-text-muted)]">
        Digital Diary — Not Debt Tracker
      </p>
    </div>
  );
}
