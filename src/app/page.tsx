"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type SessionInfo = {
  hasMerchant: boolean;
  hasCustomer: boolean;
  merchantPhone?: string;
  customerPhone?: string;
  customerName?: string;
};

export default function LandingPage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Check localStorage for previous sessions
        const merchantId = localStorage.getItem("merchant_id");
        const merchantPhone = localStorage.getItem("merchant_phone");
        const customerRaw = localStorage.getItem("sajilo_customer_session");
        let customerSession: { phone?: string; name?: string } | null = null;
        try {
          customerSession = customerRaw ? JSON.parse(customerRaw) : null;
        } catch { /* ignore */ }

        const hasMerchant = !!(merchantId && merchantPhone);
        const hasCustomer = !!(customerSession?.phone);

        if (!cancelled) {
          setSession({
            hasMerchant,
            hasCustomer,
            merchantPhone: merchantPhone ?? undefined,
            customerPhone: customerSession?.phone,
            customerName: customerSession?.name,
          });
        }
      } catch {
        if (!cancelled) setSession({ hasMerchant: false, hasCustomer: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleContinue = async (role: "merchant" | "customer") => {
    setRedirecting(role);
    try {
      // Verify session is still valid server-side before redirecting
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const data: { userId: string | null; roles: string[] } = await res.json();
      if (data.userId && data.roles.includes(role)) {
        // Session valid — redirect to dashboard
        window.location.href = role === "merchant" ? "/merchant/dashboard" : "/customer/dashboard";
      } else {
        // Session expired or role mismatch — fall back to phone input
        const swVersion = localStorage.getItem("sw_version");
        const pwaDismissed = localStorage.getItem("pwa-install-dismissed");
        localStorage.removeItem("merchant_id");
        localStorage.removeItem("merchant_phone");
        localStorage.removeItem("sajilo_customer_session");
        if (swVersion) localStorage.setItem("sw_version", swVersion);
        if (pwaDismissed) localStorage.setItem("pwa-install-dismissed", pwaDismissed);
        window.location.href = "/login?signedOut=1";
      }
    } catch {
      // Network error — try redirect anyway, proxy will handle
      window.location.href = role === "merchant" ? "/merchant/dashboard" : "/customer/dashboard";
    }
  };

  const handleDifferentAccount = () => {
    // Preserve app config before clearing
    const swVersion = localStorage.getItem("sw_version");
    const pwaDismissed = localStorage.getItem("pwa-install-dismissed");
    // Clear previous session state so /login doesn't auto-redirect
    localStorage.removeItem("merchant_id");
    localStorage.removeItem("merchant_phone");
    localStorage.removeItem("sajilo_customer_session");
    if (swVersion) localStorage.setItem("sw_version", swVersion);
    if (pwaDismissed) localStorage.setItem("pwa-install-dismissed", pwaDismissed);
    window.location.href = "/login?signedOut=1";
  };

  const maskPhone = (phone?: string) => {
    if (!phone || phone.length < 4) return phone || "";
    return `${phone.slice(0, 3)}****${phone.slice(-2)}`;
  };

  const hasAnySession = session && (session.hasMerchant || session.hasCustomer);

  return (
    <div className="min-h-dvh bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-blue-600/10" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 sm:pt-24 sm:pb-20">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-full mb-6">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-emerald-700">Nepal&apos;s #1 Digital Ledger</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight">
              QR Hisab
              <span className="block text-emerald-600 mt-2">सजिलो खाता</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Digital credit ledger and delivery diary for small retail shops in Nepal.
              Track credits, manage customers, and grow your business — all from your phone.
            </p>
          </div>
        </div>
      </div>

      {/* ── Session Cards / Sign In Section ── */}
      <div className="max-w-lg mx-auto px-4 sm:px-6 -mt-4 mb-16">
        {loading ? (
          /* Loading skeleton */
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 text-center">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-sm text-gray-400">Checking your session...</p>
          </div>
        ) : hasAnySession ? (
          /* ── Returning user: show session cards ── */
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8 space-y-4 animate-entrance">
            <div className="text-center mb-2">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Welcome back!</h2>
              <p className="text-sm text-gray-500 mt-1">Choose an account to continue</p>
            </div>

            {/* Merchant Card */}
            {session?.hasMerchant && (
              <button
                onClick={() => handleContinue("merchant")}
                disabled={!!redirecting}
                className="w-full p-4 bg-gradient-to-r from-blue-50 to-white rounded-2xl border border-blue-100 hover:border-blue-300 hover:shadow-md active:scale-[0.98] transition-all flex items-center gap-4 text-left disabled:opacity-60 animate-entrance-delay-1"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">Continue as Merchant</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {maskPhone(session.merchantPhone)}
                  </p>
                </div>
                {redirecting === "merchant" ? (
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                )}
              </button>
            )}

            {/* Customer Card */}
            {session?.hasCustomer && (
              <button
                onClick={() => handleContinue("customer")}
                disabled={!!redirecting}
                className="w-full p-4 bg-gradient-to-r from-emerald-50 to-white rounded-2xl border border-emerald-100 hover:border-emerald-300 hover:shadow-md active:scale-[0.98] transition-all flex items-center gap-4 text-left disabled:opacity-60 animate-entrance-delay-2"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">Continue as Customer</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {session.customerName ? `${session.customerName} · ` : ""}{maskPhone(session.customerPhone)}
                  </p>
                </div>
                {redirecting === "customer" ? (
                  <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                )}
              </button>
            )}

            {/* Divider */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-gray-400">or</span>
              </div>
            </div>

            {/* Sign in with different account */}
            <button
              onClick={handleDifferentAccount}
              className="w-full py-3 text-sm font-medium text-emerald-600 hover:text-emerald-700 active:text-emerald-800 transition-colors rounded-xl hover:bg-emerald-50 active:scale-[0.98]"
            >
              Sign in with a different account
            </button>
          </div>
        ) : (
          /* ── No session: show get started buttons ── */
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8 text-center space-y-4 animate-entrance">
            <div className="w-14 h-14 mx-auto mb-2 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Get Started</h2>
            <p className="text-sm text-gray-500">Sign in or create a free account</p>

            <div className="space-y-3 pt-2">
              <Link
                href="/login"
                className="block w-full py-3.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-[0.98]"
              >
                Sign In
              </Link>
              <Link
                href="/scan"
                className="block w-full py-3.5 bg-white text-emerald-600 rounded-xl font-semibold border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all active:scale-[0.98]"
              >
                Scan QR Code
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Everything you need to manage your shop
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Simple, powerful tools designed for Nepali retail shops
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Digital Khata</h3>
            <p className="text-gray-600">
              Replace your physical ledger with a digital credit system. Track who owes what,
              with complete transaction history.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">QR Code Access</h3>
            <p className="text-gray-600">
              Customers scan your QR code to view their balance and transaction history.
              No app download needed — works in any browser.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">SMS Reminders</h3>
            <p className="text-gray-600">
              Send automatic payment reminders to customers via SMS. Keep your cash flow healthy
              with timely follow-ups.
            </p>
          </div>
        </div>
      </div>

      {/* How it Works */}
      <div className="bg-gray-50 py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">How it works</h2>
            <p className="mt-4 text-lg text-gray-600">Get started in 3 simple steps</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">1</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Register</h3>
              <p className="text-gray-600">Sign up with your phone number and set a 4-digit PIN. Takes less than a minute.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">2</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Add Customers</h3>
              <p className="text-gray-600">Import your existing customers or add them one by one. Set credit limits for each.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">3</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Start Selling</h3>
              <p className="text-gray-600">Record credit sales, accept payments, and track your business — all from your phone.</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Ready to go digital?</h2>
          <p className="mt-4 text-lg text-gray-600 mb-8">
            Join thousands of merchants who have transformed their business with QR Hisab.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-8 py-4 bg-emerald-600 text-white rounded-2xl font-semibold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300 active:scale-[0.98]"
          >
            Start Using QR Hisab — It&apos;s Free
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="font-bold text-gray-900">QR Hisab</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/login" className="hover:text-emerald-600 transition-colors">Login</Link>
              <span>&copy; {new Date().getFullYear()} QR Hisab</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
