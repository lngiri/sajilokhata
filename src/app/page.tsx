"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const fadeInView = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
} as const;

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
      {children}
    </h2>
  );
}

function SectionSub({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto">
      {children}
    </p>
  );
}

export default function LandingPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data: { userId: string | null } = await res.json();
        if (cancelled) return;
        if (data.userId) {
          window.location.replace("/merchant/dashboard");
          return;
        }
        setLoggedIn(false);
      } catch {
        // offline — show "Get Started"
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const ctaText = checking ? "Loading…" : "Get Started Free";
  const ctaHref = "/login";

  return (
    <div className="fixed inset-0 overflow-y-auto bg-white z-[1] overscroll-contain">
      <div className="min-h-screen flex flex-col">

        {/* ── NAV ── */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="sticky top-0 z-20 bg-white/70 backdrop-blur-lg border-b border-gray-100"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 xl:px-8 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-sm">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="font-bold text-gray-900">QR Hisab</span>
            </div>
            <a
              href={ctaHref}
              className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Sign In
            </a>
          </div>
        </motion.header>

        {/* ── HERO ── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/60 to-white pointer-events-none" />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 xl:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32 lg:pt-36 lg:pb-40 text-center">
            <motion.div {...fadeInView}>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold mb-6">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Trusted by shops across Nepal
              </div>
            </motion.div>

            <motion.h1
              {...fadeInView}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-gray-900 leading-[1.1] tracking-tight"
            >
              Your Shop&apos;s Digital{" "}
              <span className="text-emerald-600">Credit Ledger</span>
            </motion.h1>

            <motion.p
              {...fadeInView}
              transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
              className="mt-5 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed"
            >
              Replace your dusty notebook with a modern, mobile-first diary.
              Track credits, send automated SMS reminders, and manage daily
              sales — all from your phone.
            </motion.p>

            <motion.div
              {...fadeInView}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <a
                href={ctaHref}
                className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-base shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transition-all active:scale-[0.97]"
              >
                {ctaText}
              </a>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto px-8 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-base transition-colors"
              >
                See How It Works
              </a>
            </motion.div>

            {/* Stats row */}
            <motion.div
              {...fadeInView}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto"
            >
              {[
                { label: "Active Shops", value: "500+" },
                { label: "Transactions/Mo", value: "50K+" },
                { label: "SMS Sent", value: "100K+" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">{s.value}</p>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── WHY QR Hisab ── */}
        <section className="py-20 sm:py-28 lg:py-32 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 xl:px-8">
            <motion.div {...fadeInView} className="text-center mb-14 lg:mb-16">
              <SectionHeading>Why QR Hisab?</SectionHeading>
              <SectionSub>
                Built for the way Nepali shops actually work — fast, offline-first,
                and dead simple.
              </SectionSub>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Blazing Fast Entry",
                  desc: "Scan a QR code and log a credit entry in under 5 seconds. No typing, no fuss.",
                  icon: "M13 10V3L4 14h7v7l9-11h-7z",
                },
                {
                  title: "Auto SMS Alerts",
                  desc: "Customers get instant SMS receipts. No more forgotten dues or 'bhai maile tirisake'.",
                  icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z",
                },
                {
                  title: "Offline Ready",
                  desc: "Network down? No problem. Log entries offline — they sync automatically when you reconnect.",
                  icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
                },
                {
                  title: "Daily Sales Dashboard",
                  desc: "See today's total, pending collections, and top customers at a glance.",
                  icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
                },
                {
                  title: "Customer Management",
                  desc: "Search customers by phone, view their full history, and know who owes what.",
                  icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
                },
                {
                  title: "Delivery Diary",
                  desc: "Log doorstep deliveries with photo proof. Separate from credit, perfect for kirana shops.",
                  icon: "M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h17.25m-17.25 0V5.625A2.25 2.25 0 015.625 3.375h2.25a.75.75 0 00.75-.75V3.375m4.5 0a.75.75 0 00.75.75h2.25A2.25 2.25 0 0117.25 5.625v5.625m0 0H3.375",
                },
              ].map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:border-emerald-100 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                    </svg>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1.5">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="py-20 sm:py-28 lg:py-32">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 xl:px-8">
            <motion.div {...fadeInView} className="text-center mb-14">
              <SectionHeading>Get started in 3 minutes</SectionHeading>
              <SectionSub>No hardware, no training, no paperwork.</SectionSub>
            </motion.div>

            <div className="grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                {
                  step: "01",
                  title: "Sign Up",
                  desc: "Enter your shop phone number, verify with OTP, and you're in. That's it.",
                },
                {
                  step: "02",
                  title: "Print Your QR",
                  desc: "Download a unique QR code for your shop. Stick it on the counter or share it with customers.",
                },
                {
                  step: "03",
                  title: "Start Managing",
                  desc: "Scan, log, and track credits. SMS reminders go out automatically. No chasing people.",
                },
              ].map((s, i) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                  className="text-center"
                >
                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-5">
                    <span className="text-xl font-extrabold text-emerald-600">{s.step}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">{s.desc}</p>
                  {i < 2 && (
                    <div className="hidden sm:block absolute top-8 left-[60%] w-[40%] h-0.5 border-t-2 border-dashed border-gray-200" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SECURITY / TRUST ── */}
        <section className="py-20 sm:py-28 lg:py-32 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 xl:px-8">
            <motion.div {...fadeInView} className="text-center mb-14 lg:mb-16">
              <SectionHeading>Your data is safe</SectionHeading>
              <SectionSub>
                We take security seriously so you can focus on your business.
              </SectionSub>
            </motion.div>

            <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                {
                  title: "Encrypted by Default",
                  desc: "All data is encrypted in transit (TLS) and at rest. We use Supabase — the same infrastructure trusted by Fortune 500 companies.",
                  icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
                },
                {
                  title: "Offline-First Architecture",
                  desc: "Your data lives on your device too. Even if the server goes down, you never lose an entry.",
                  icon: "M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9",
                },
                {
                  title: "No Credit Card Needed",
                  desc: "Start with a free account. No hidden fees, no contract, no surprise charges.",
                  icon: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z",
                },
              ].map((s, i) => (
                <motion.div
                  key={s.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: i * 0.12 }}
                  className="bg-white rounded-2xl border border-gray-100 p-6 text-center"
                >
                  <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                    </svg>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1.5">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-20 sm:py-28 lg:py-32">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 xl:px-8 text-center">
            <motion.div {...fadeInView}>
              <SectionHeading>
                Ready to go digital?
              </SectionHeading>
              <SectionSub>
                Join 500+ shops already using QR Hisab. Free to start, takes
                2 minutes to set up.
              </SectionSub>
            </motion.div>

            <motion.div
              {...fadeInView}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-8"
            >
              <a
                href={ctaHref}
                className="inline-flex items-center gap-2 px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-lg shadow-xl shadow-emerald-200 hover:shadow-emerald-300 transition-all active:scale-[0.97]"
              >
                {ctaText}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
            </motion.div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="mt-auto border-t border-gray-100 py-8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 xl:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span>QR Hisab — Digital Diary, Not Debt Tracker</span>
            </div>
            <p className="text-xs text-gray-400">
              &copy; {new Date().getFullYear()} QR Hisab. All rights reserved.
            </p>
          </div>
        </footer>

      </div>
    </div>
  );
}
