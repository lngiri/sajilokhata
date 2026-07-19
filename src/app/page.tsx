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

/* ─── Icons (inline SVGs to avoid extra imports) ─── */
const Icons = {
  ledger: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  ),
  qr: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
    </svg>
  ),
  sms: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  ),
  shield: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  chart: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  users: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  arrow: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  ),
  star: (
    <svg className="w-4 h-4 fill-amber-400 text-amber-400" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  ),
  play: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  store: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
    </svg>
  ),
  delivery: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H18.75m-7.5-3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
};

export default function LandingPage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
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
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const data: { userId: string | null; roles: string[] } = await res.json();
      if (data.userId && data.roles.includes(role)) {
        window.location.href = role === "merchant" ? "/merchant/dashboard" : "/customer/dashboard";
      } else {
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
      window.location.href = role === "merchant" ? "/merchant/dashboard" : "/customer/dashboard";
    }
  };

  const handleDifferentAccount = () => {
    const swVersion = localStorage.getItem("sw_version");
    const pwaDismissed = localStorage.getItem("pwa-install-dismissed");
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

  /* ──────────────────────────────────────────────────────── */
  /*  DATA                                                    */
  /* ──────────────────────────────────────────────────────── */
  const problems = [
    { title: "Torn notebook pages", desc: "Physical khata books get lost, damaged, or stolen. Your entire business history — gone." },
    { title: "Forgotten debts", desc: "Without a system, customers forget what they owe. You lose money every month." },
    { title: "Manual calculations", desc: "Spending hours adding up columns, making mistakes, and losing track of payments." },
    { title: "No payment reminders", desc: "Customers don't pay on time because nobody reminds them. Cash flow suffers." },
  ];

  const solutions = [
    { title: "Cloud-synced digital ledger", desc: "Every transaction is safely stored in the cloud. Access from any phone, anytime." },
    { title: "Instant balance lookup", desc: "See exactly who owes what with one tap. No more guessing or翻翻 notebooks." },
    { title: "Automatic calculations", desc: "Balances, totals, and summaries are calculated instantly. Zero math errors." },
    { title: "SMS payment reminders", desc: "Send automated reminders to customers. Get paid faster without the awkwardness." },
  ];

  const features = [
    { icon: Icons.ledger, title: "Digital Khata", desc: "Replace your physical ledger with a secure digital credit system. Track every rupee with complete transaction history.", iconBg: "bg-emerald-100", iconText: "text-emerald-600" },
    { icon: Icons.qr, title: "QR Code Access", desc: "Customers scan your QR code to view their balance. No app download needed — works in any browser.", iconBg: "bg-blue-100", iconText: "text-blue-600" },
    { icon: Icons.sms, title: "SMS Reminders", desc: "Send automatic payment reminders via SMS. Keep your cash flow healthy with timely follow-ups.", iconBg: "bg-violet-100", iconText: "text-violet-600" },
    { icon: Icons.shield, title: "PIN Security", desc: "4-digit PIN protects your account. Only you can access your business data.", iconBg: "bg-amber-100", iconText: "text-amber-600" },
    { icon: Icons.chart, title: "Live Dashboard", desc: "See today's sales, total outstanding, and pending approvals — all updated in real-time.", iconBg: "bg-rose-100", iconText: "text-rose-600" },
    { icon: Icons.users, title: "Multi-Customer", desc: "Manage hundreds of customers. Set individual credit limits and track each relationship.", iconBg: "bg-cyan-100", iconText: "text-cyan-600" },
  ];

  const useCases = [
    { icon: Icons.store, title: "Kirana / grocery shops", desc: "Track daily credit sales to regular customers. Send monthly balance summaries via SMS." },
    { icon: Icons.delivery, title: "Delivery businesses", desc: "Record orders on-the-go. Customers confirm delivery digitally — no paper needed." },
    { icon: Icons.users, title: "Freelancers & service providers", desc: "Bill clients for projects. Track partial payments and outstanding invoices." },
  ];

  const steps = [
    { num: "1", title: "Register", desc: "Sign up with your phone number and set a 4-digit PIN. Takes less than a minute." },
    { num: "2", title: "Add Customers", desc: "Import your existing customers or add them one by one. Set credit limits for each." },
    { num: "3", title: "Start Selling", desc: "Record credit sales, accept payments, and track your business — all from your phone." },
  ];

  const testimonials = [
    { name: "Ramesh S.", role: "Kirana shop owner, Kathmandu", text: "I used to carry a notebook everywhere. Now I just open QR Hisab. My customers love seeing their balance instantly." },
    { name: "Sita D.", role: "Pharmacy owner, Pokhara", text: "The SMS reminders alone have recovered Rs. 50,000+ in forgotten debts. Best tool for small shops." },
    { name: "Ram K.", role: "Hardware store, Chitwan", text: "Managing 200+ customers was a nightmare. QR Hisab makes it feel effortless." },
  ];

  const stats = [
    { value: "5,000+", label: "Active merchants" },
    { value: "50,000+", label: "Customers tracked" },
    { value: "Rs. 10Cr+", label: "Credits managed" },
    { value: "4.8/5", label: "User rating" },
  ];

  /* ──────────────────────────────────────────────────────── */
  /*  RENDER                                                  */
  /* ──────────────────────────────────────────────────────── */
  return (
    <div className="min-h-dvh bg-white">
      {/* ══════ NAVBAR ══════ */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-900">QR Hisab</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-emerald-600 transition-colors hidden sm:block">
              Log in
            </Link>
            <Link href="/login" className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all active:scale-[0.97] shadow-sm">
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ══════ HERO ══════ */}
      <section className="relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-emerald-100/60 via-emerald-50/40 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-0 w-72 h-72 bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 left-0 w-60 h-60 bg-violet-100/30 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 sm:pt-28 sm:pb-24">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full mb-8 animate-entrance">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-emerald-700">Nepal&apos;s #1 Digital Ledger</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-gray-900 tracking-tight leading-[1.1] animate-entrance-delay-1">
              Stop losing money on
              <span className="block text-emerald-600 mt-2">forgotten debts</span>
            </h1>

            {/* Subheadline */}
            <p className="mt-6 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed animate-entrance-delay-2">
              QR Hisab is the digital credit ledger for small shops in Nepal.
              Track who owes you, send payment reminders, and never lose a rupee again.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-entrance-delay-2">
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-semibold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300 active:scale-[0.98]"
              >
                Start Free — No Credit Card
                {Icons.arrow}
              </Link>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 rounded-2xl font-semibold text-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all active:scale-[0.98]"
              >
                See How It Works
              </a>
            </div>

            {/* Trust signals */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400">
              <span className="flex items-center gap-1.5">{Icons.check} Free forever for basic use</span>
              <span className="flex items-center gap-1.5">{Icons.check} Works on any phone</span>
              <span className="flex items-center gap-1.5">{Icons.check} No app download needed</span>
            </div>
          </div>

          {/* Hero visual — mockup */}
          <div className="mt-16 max-w-lg mx-auto animate-entrance-delay-2">
            <div className="relative bg-gray-900 rounded-[2.5rem] p-2 shadow-2xl shadow-gray-300/50">
              <div className="bg-white rounded-[2rem] overflow-hidden">
                {/* Phone status bar */}
                <div className="h-10 bg-emerald-600 flex items-center justify-between px-6">
                  <span className="text-xs font-semibold text-white/80">9:41</span>
                  <span className="text-xs font-bold text-white">QR Hisab</span>
                  <span className="text-xs text-white/80">●●●</span>
                </div>
                {/* Dashboard preview */}
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <span className="text-sm font-bold text-emerald-600">R</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Ramesh&apos;s Shop</p>
                      <p className="text-xs text-gray-400">Today&apos;s sales</p>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-white">
                    <p className="text-xs opacity-80">Total Outstanding</p>
                    <p className="text-2xl font-bold mt-1">Rs. 45,200</p>
                    <p className="text-xs opacity-60 mt-1">Across 23 customers</p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: "Sita Devi", amount: "Rs. 3,500", color: "bg-amber-100 text-amber-700" },
                      { name: "Ram Bahadur", amount: "Rs. 2,100", color: "bg-red-100 text-red-700" },
                      { name: "Gita Store", amount: "Rs. 800", color: "bg-blue-100 text-blue-700" },
                    ].map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-xs font-semibold text-gray-600">{c.name[0]}</span>
                          </div>
                          <span className="text-sm font-medium text-gray-700">{c.name}</span>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${c.color}`}>{c.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ STATS BAR ══════ */}
      <section className="border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl sm:text-4xl font-extrabold text-emerald-600">{s.value}</p>
                <p className="text-sm text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ PROBLEM / SOLUTION ══════ */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3">The Problem & Solution</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Your notebook can&apos;t do this
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              Traditional khata books are outdated. QR Hisab solves the real problems Nepali shop owners face every day.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Problems */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">Without QR Hisab</h3>
              </div>
              <div className="space-y-4">
                {problems.map((p, i) => (
                  <div key={i} className="p-4 bg-red-50/50 border border-red-100 rounded-xl">
                    <p className="font-semibold text-gray-900 text-sm">{p.title}</p>
                    <p className="text-sm text-gray-500 mt-1">{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Solutions */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">With QR Hisab</h3>
              </div>
              <div className="space-y-4">
                {solutions.map((s, i) => (
                  <div key={i} className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                    <p className="font-semibold text-gray-900 text-sm">{s.title}</p>
                    <p className="text-sm text-gray-500 mt-1">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ TARGET AUDIENCE ══════ */}
      <section className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3">Built For</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Small businesses that deserve big tools
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              Whether you run a kirana shop or a delivery service, QR Hisab adapts to your workflow.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {useCases.map((uc, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md hover:border-emerald-100 transition-all group">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-5 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                  {uc.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{uc.title}</h3>
                <p className="text-gray-500 leading-relaxed">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ FEATURES ══════ */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Everything you need to manage your shop
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Simple, powerful tools designed for Nepali retail shops
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all group">
                <div className={`w-12 h-12 ${f.iconBg} rounded-xl flex items-center justify-center mb-4 ${f.iconText} group-hover:scale-110 transition-transform`}>
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ HOW IT WORKS ══════ */}
      <section id="how-it-works" className="py-20 sm:py-28 bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-bold">
              Get started in 3 simple steps
            </h2>
            <p className="mt-4 text-lg text-gray-400">
              No training needed. If you can use a phone, you can use QR Hisab.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-emerald-500/50 via-emerald-400 to-emerald-500/50" />

            {steps.map((s, i) => (
              <div key={i} className="text-center relative">
                <div className="w-24 h-24 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-extrabold relative z-10 shadow-lg shadow-emerald-600/30">
                  {s.num}
                </div>
                <h3 className="text-xl font-bold mb-2">{s.title}</h3>
                <p className="text-gray-400 leading-relaxed max-w-xs mx-auto">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ TESTIMONIALS ══════ */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3">Testimonials</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Trusted by shop owners across Nepal
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(5)].map((_, j) => <span key={j}>{Icons.star}</span>)}
                </div>
                <p className="text-gray-600 leading-relaxed mb-4">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-sm font-bold text-emerald-600">{t.name[0]}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ SESSION CARDS / SIGN IN ══════ */}
      {hasAnySession && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-lg mx-auto px-4">
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8 space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-xl font-bold text-gray-900">Welcome back!</h2>
                <p className="text-sm text-gray-500 mt-1">Choose an account to continue</p>
              </div>

              {session?.hasMerchant && (
                <button
                  onClick={() => handleContinue("merchant")}
                  disabled={!!redirecting}
                  className="w-full p-4 bg-gradient-to-r from-blue-50 to-white rounded-2xl border border-blue-100 hover:border-blue-300 hover:shadow-md active:scale-[0.98] transition-all flex items-center gap-4 text-left disabled:opacity-60"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600">{Icons.store}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">Continue as Merchant</p>
                    <p className="text-xs text-gray-500 mt-0.5">{maskPhone(session.merchantPhone)}</p>
                  </div>
                  {redirecting === "merchant" ? (
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-gray-300">{Icons.arrow}</span>
                  )}
                </button>
              )}

              {session?.hasCustomer && (
                <button
                  onClick={() => handleContinue("customer")}
                  disabled={!!redirecting}
                  className="w-full p-4 bg-gradient-to-r from-emerald-50 to-white rounded-2xl border border-emerald-100 hover:border-emerald-300 hover:shadow-md active:scale-[0.98] transition-all flex items-center gap-4 text-left disabled:opacity-60"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600">{Icons.users}</span>
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
                    <span className="text-gray-300">{Icons.arrow}</span>
                  )}
                </button>
              )}

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white text-gray-400">or</span>
                </div>
              </div>

              <button
                onClick={handleDifferentAccount}
                className="w-full py-3 text-sm font-medium text-emerald-600 hover:text-emerald-700 active:text-emerald-800 transition-colors rounded-xl hover:bg-emerald-50 active:scale-[0.98]"
              >
                Sign in with a different account
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ══════ FINAL CTA ══════ */}
      <section className="py-20 sm:py-28 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold">
            Ready to go digital?
          </h2>
          <p className="mt-6 text-lg sm:text-xl text-emerald-100 max-w-2xl mx-auto">
            Join thousands of merchants who have transformed their business with QR Hisab.
            Start in under 60 seconds.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-emerald-700 rounded-2xl font-bold text-lg hover:bg-emerald-50 transition-all shadow-xl active:scale-[0.98]"
            >
              Start Using QR Hisab — It&apos;s Free
              {Icons.arrow}
            </Link>
          </div>
          <p className="mt-6 text-sm text-emerald-200">No credit card required &middot; Free for basic use &middot; Works on any phone</p>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-lg font-bold text-gray-900">QR Hisab</span>
              </div>
              <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
                Digital credit ledger and delivery diary for small retail shops in Nepal.
                Track credits, manage customers, and grow your business — all from your phone.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#how-it-works" className="hover:text-emerald-600 transition-colors">How It Works</a></li>
                <li><Link href="/login" className="hover:text-emerald-600 transition-colors">Get Started</Link></li>
                <li><Link href="/login" className="hover:text-emerald-600 transition-colors">Login</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><span className="cursor-default">Privacy Policy</span></li>
                <li><span className="cursor-default">Terms of Service</span></li>
                <li><span className="cursor-default">Refund Policy</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} QR Hisab. All rights reserved.</p>
            <p className="text-sm text-gray-400">Made with ❤️ in Nepal</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
