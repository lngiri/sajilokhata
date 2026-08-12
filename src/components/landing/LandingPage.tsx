"use client";

import { useState, useEffect, useRef } from "react";
import LogoWithAbout from "@/components/LogoWithAbout";
import AboutSheet from "@/components/AboutSheet";
import { content, faqItems, type Lang } from "./content";

const LOGIN = "/login?signedOut=1";

function useScrollReveal() {
  const observed = useRef(false);
  useEffect(() => {
    if (observed.current) return;
    observed.current = true;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -32px 0px" }
    );
    const timer = setTimeout(() => {
      document.querySelectorAll(".animate-card-in").forEach((el) => observer.observe(el));
    }, 80);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);
}

const Icons = {
  check: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  arrow: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  ),
  menu: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  close: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  chevron: (
    <svg className="w-5 h-5 shrink-0 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  ),
};

function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 text-xs font-bold">
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={`rounded-full px-3 py-1.5 transition-colors ${lang === "en" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("ne")}
        aria-pressed={lang === "ne"}
        className={`rounded-full px-3 py-1.5 transition-colors ${lang === "ne" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
      >
        ने
      </button>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="relative mx-auto max-w-md">
      <div className="absolute -right-2 top-8 z-10 w-36 rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-xl dark:bg-[var(--color-surface)] sm:-right-8 sm:w-40">
        <div className="mx-auto mb-2 grid h-20 w-20 grid-cols-4 gap-0.5 rounded-lg border-2 border-[var(--color-primary)] p-1.5">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className={`rounded-sm ${i % 3 === 0 ? "bg-[var(--color-primary)]" : "bg-[var(--color-primary)]/20"}`} />
          ))}
        </div>
        <p className="text-center text-xs font-bold text-[var(--color-primary-dark)]">Scan to pay</p>
      </div>
      <div className="relative rounded-[2.5rem] bg-stone-950 p-2 shadow-2xl dark:bg-stone-900">
        <div className="overflow-hidden rounded-[2rem] bg-[var(--color-surface)]">
          <div className="flex h-10 items-center justify-between bg-[var(--color-primary-surface)] px-6">
            <span className="text-xs font-semibold text-white/80">9:41</span>
            <span className="text-xs font-bold text-white">QR Hisab</span>
            <span className="text-xs text-white/80">●●●</span>
          </div>
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)]/15">
                <span className="text-sm font-bold text-[var(--color-primary)]">R</span>
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--color-text)]">Ramesh&apos;s Shop</p>
                <p className="text-xs text-[var(--color-text-muted)]">Dashboard</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[var(--radius-card)] bg-gradient-to-br from-[var(--color-primary-surface)] to-[var(--color-primary-surface-dark)] p-3 text-[var(--color-primary-foreground)]">
                <p className="text-[10px] opacity-80">To Collect</p>
                <p className="text-lg font-extrabold">Rs. 45,200</p>
              </div>
              <div className="rounded-[var(--radius-card)] bg-gradient-to-br from-purple-600 to-purple-700 p-3 text-white">
                <p className="text-[10px] opacity-80">Purchases</p>
                <p className="text-lg font-extrabold">Rs. 12,800</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { name: "Sita Devi", amount: "Rs. 3,500", tag: "Customer" },
                { name: "Kathmandu Traders", amount: "Rs. 12,800", tag: "M2M" },
              ].map((row) => (
                <div key={row.name} className="flex items-center justify-between rounded-[var(--radius-button)] bg-[var(--color-bg)] p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-text)]">{row.name}</span>
                    <span className="rounded-full bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[10px] text-[var(--color-primary-dark)]">{row.tag}</span>
                  </div>
                  <span className="rounded-full bg-[var(--color-primary)]/10 px-2.5 py-1 text-xs font-bold text-[var(--color-primary-dark)]">{row.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type SessionInfo = {
  hasMerchant: boolean;
  hasCustomer: boolean;
  merchantPhone?: string;
  customerPhone?: string;
  customerName?: string;
};

function SessionBlock({ t }: { t: { welcome: string; choose: string; merchant: string; customer: string; different: string; or: string } }) {
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [redirecting, setRedirecting] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const merchantId = localStorage.getItem("merchant_id");
      const merchantPhone = localStorage.getItem("merchant_phone");
      const customerRaw = localStorage.getItem("sajilo_customer_session");
      let customerSession: { phone?: string; name?: string } | null = null;
      try {
        customerSession = customerRaw ? JSON.parse(customerRaw) : null;
      } catch {
        /* ignore */
      }
      const hasMerchant = !!(merchantId && merchantPhone);
      const hasCustomer = !!customerSession?.phone;
      if (hasMerchant || hasCustomer) {
        setSession({
          hasMerchant,
          hasCustomer,
          merchantPhone: merchantPhone ?? undefined,
          customerPhone: customerSession?.phone,
          customerName: customerSession?.name,
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const maskPhone = (phone?: string) => {
    if (!phone || phone.length < 4) return phone || "";
    return `${phone.slice(0, 3)}****${phone.slice(-2)}`;
  };

  const handleContinue = async (role: "merchant" | "customer") => {
    setRedirecting(role);
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const data: { userId: string | null; roles: string[] } = await res.json();
      if (data.userId && data.roles.includes(role)) {
        window.location.href = role === "merchant" ? "/merchant/dashboard" : "/customer/dashboard";
      } else {
        window.location.href = LOGIN;
      }
    } catch {
      window.location.href = role === "merchant" ? "/merchant/dashboard" : "/customer/dashboard";
    }
  };

  const handleDifferentAccount = () => {
    localStorage.removeItem("merchant_id");
    localStorage.removeItem("merchant_phone");
    localStorage.removeItem("sajilo_customer_session");
    window.location.href = LOGIN;
  };

  if (!mounted || !session) return null;

  return (
    <section className="bg-[var(--color-surface)] py-16">
      <div className="mx-auto max-w-lg px-4">
        <div className="space-y-4 rounded-[var(--radius-dialog)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-lg sm:p-8">
          <div className="mb-2 text-center">
            <h2 className="text-xl font-extrabold text-[var(--color-text)]">{t.welcome}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t.choose}</p>
          </div>
          {session.hasMerchant && (
            <button
              type="button"
              onClick={() => handleContinue("merchant")}
              disabled={!!redirecting}
              className="flex w-full items-center gap-4 rounded-[var(--radius-button)] border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-4 text-left transition-all hover:border-blue-300 hover:shadow-md active:scale-[0.98] disabled:opacity-60 dark:border-blue-900/50 dark:from-blue-950/30 dark:to-[var(--color-surface)]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950/30">
                <svg className="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[var(--color-text)]">{t.merchant}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{maskPhone(session.merchantPhone)}</p>
              </div>
            </button>
          )}
          {session.hasCustomer && (
            <button
              type="button"
              onClick={() => handleContinue("customer")}
              disabled={!!redirecting}
              className="flex w-full items-center gap-4 rounded-[var(--radius-button)] border border-[var(--color-primary)]/15 bg-gradient-to-r from-[var(--color-primary)]/5 to-[var(--color-surface)] p-4 text-left transition-all hover:border-[var(--color-primary)]/40 hover:shadow-md active:scale-[0.98] disabled:opacity-60"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10">
                <svg className="h-7 w-7 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[var(--color-text)]">{t.customer}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  {session.customerName ? `${session.customerName} · ` : ""}
                  {maskPhone(session.customerPhone)}
                </p>
              </div>
            </button>
          )}
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--color-border)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[var(--color-surface)] px-3 text-[var(--color-text-muted)]">{t.or}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDifferentAccount}
            className="w-full rounded-xl py-3 text-sm font-bold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/5 hover:text-[var(--color-primary-dark)] active:scale-[0.98]"
          >
            {t.different}
          </button>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ label, title, sub }: { label: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto mb-14 max-w-2xl text-center">
      <p className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--color-primary)]">{label}</p>
      <h2 className="text-3xl font-extrabold text-[var(--color-text)] sm:text-4xl">{title}</h2>
      {sub && <p className="mt-4 text-lg leading-relaxed text-[var(--color-text-muted)]">{sub}</p>}
    </div>
  );
}

export default function LandingPage() {
  useScrollReveal();
  const [lang, setLang] = useState<Lang>("en");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const t = content[lang];
  const navLinks = [
    { href: "#how-it-works", label: t.nav.howItWorks },
    { href: "#features", label: t.nav.features },
    { href: "#pricing", label: t.nav.pricing },
    { href: "#faq", label: t.nav.faq },
  ];

  const featureIcons = ["qr", "chart", "sms", "shield", "shop", "offline"] as const;
  const featureIconMap = {
    qr: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 14.625h.008v.008h-.008v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 3.75h.008v.008h-.008v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
    chart: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    sms: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
    shield: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    shop: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
      </svg>
    ),
    offline: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
      </svg>
    ),
  };

  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      <nav className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <LogoWithAbout size={36} showAnimation onClick={() => setAboutOpen(true)} className="p-1" />
            <span className="text-lg font-extrabold text-[var(--color-text)]">QR Hisab</span>
          </div>

          <div className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-primary)]">
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <LangToggle lang={lang} setLang={setLang} />
            <a href={LOGIN} className="hidden text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-primary)] sm:block">
              {t.nav.login}
            </a>
            <a
              href={LOGIN}
              className="btn-bounce hidden rounded-[var(--radius-button)] bg-[var(--color-primary-surface)] px-5 py-2.5 text-sm font-bold text-[var(--color-primary-foreground)] shadow-sm transition-all hover:bg-[var(--color-primary-surface-hover)] active:scale-[0.97] sm:inline-flex"
            >
              {t.nav.startFree}
            </a>
            <button type="button" className="rounded-lg p-2 text-[var(--color-text)] md:hidden" onClick={() => setMobileNav((v) => !v)} aria-label={mobileNav ? "Close menu" : "Open menu"}>
              {mobileNav ? Icons.close : Icons.menu}
            </button>
          </div>
        </div>

        {mobileNav && (
          <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} onClick={() => setMobileNav(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)]">
                  {link.label}
                </a>
              ))}
              <a href={LOGIN} className="rounded-[var(--radius-button)] bg-[var(--color-primary-surface)] px-4 py-3 text-center text-sm font-bold text-[var(--color-primary-foreground)]">
                {t.nav.startFree}
              </a>
            </div>
          </div>
        )}
      </nav>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[var(--color-primary)]/8 via-[var(--color-primary)]/4 to-transparent blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div className="text-center lg:text-left">
            <div className="animate-entrance mb-6 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)]/10 px-4 py-2">
              <span className="text-sm font-semibold text-[var(--color-primary-dark)]">{t.hero.eyebrow}</span>
            </div>
            <h1 className="animate-entrance-delay-1 text-4xl font-extrabold leading-[1.12] tracking-tight text-[var(--color-text)] sm:text-5xl lg:text-[3.25rem]">
              {t.hero.h1}
            </h1>
            <p className="animate-entrance-delay-2 mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-text-muted)] lg:mx-0 mx-auto">
              {t.hero.sub}
            </p>
            <div className="animate-entrance-delay-2 mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start justify-center">
              <a
                href={LOGIN}
                className="btn-bounce inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-button)] bg-[var(--color-primary-surface)] px-8 py-4 text-lg font-bold text-[var(--color-primary-foreground)] shadow-lg shadow-[var(--color-primary)]/20 transition-all hover:bg-[var(--color-primary-surface-hover)] active:scale-[0.98] sm:w-auto"
              >
                {t.hero.startFree}
                {Icons.arrow}
              </a>
              <a
                href="#how-it-works"
                className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-4 text-lg font-bold text-[var(--color-text)] transition-all hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/5 active:scale-[0.98] sm:w-auto"
              >
                {t.hero.seeHow}
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-[var(--color-text-muted)] lg:justify-start">
              {t.hero.trust.map((item) => (
                <li key={item} className="flex items-center gap-1.5 text-[var(--color-primary-dark)]">
                  {Icons.check}
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="animate-entrance-delay-2">
            <PhoneMockup />
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4 lg:px-8">
          {[
            { label: t.trust.https },
            { label: t.trust.freeStart },
            { label: t.trust.noApp },
            { label: t.trust.noTracking },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-center gap-2 text-center text-sm font-semibold text-[var(--color-text)]">
              <span className="text-[var(--color-primary)]">{Icons.check}</span>
              {item.label}
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeader label={t.howItWorks.label} title={t.howItWorks.title} sub={t.howItWorks.sub} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.howItWorks.steps.map((step, i) => (
              <div key={step.title} className={`animate-card-in ${i > 0 ? `delay-${Math.min(i, 4)}` : ""} relative rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6`}>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-extrabold text-white">
                  {i + 1}
                </div>
                <h3 className="mb-2 text-lg font-bold text-[var(--color-text)]">{step.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="bg-[var(--color-surface)] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeader label={t.features.label} title={t.features.title} sub={t.features.sub} />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {t.features.tiles.map((tile, i) => (
              <div key={tile.title} className={`animate-card-in ${i % 3 === 1 ? "delay-2" : i % 3 === 2 ? "delay-3" : "delay-1"} group rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg)] p-7 transition-all hover:border-[var(--color-primary)]/25 hover:shadow-lg`}>
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] transition-transform group-hover:scale-105">
                  {featureIconMap[featureIcons[i]]}
                </div>
                <h3 className="mb-2 text-lg font-bold text-[var(--color-text)]">{tile.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">{tile.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="shop-to-shop" className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeader label={t.shopToShop.label} title={t.shopToShop.title} sub={t.shopToShop.sub} />
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            <div className="animate-card-in rounded-[var(--radius-card)] border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-8 dark:border-purple-900/40 dark:from-purple-950/20 dark:to-[var(--color-surface)]">
              <div className="mb-4 inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                {t.shopToShop.merchant}
              </div>
              <p className="leading-relaxed text-[var(--color-text-muted)]">{t.shopToShop.merchantDesc}</p>
            </div>
            <div className="animate-card-in delay-2 rounded-[var(--radius-card)] border border-[var(--color-primary)]/20 bg-gradient-to-br from-[var(--color-primary)]/5 to-[var(--color-surface)] p-8">
              <div className="mb-4 inline-flex rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--color-primary-dark)]">
                {t.shopToShop.customer}
              </div>
              <p className="leading-relaxed text-[var(--color-text-muted)]">{t.shopToShop.customerDesc}</p>
            </div>
          </div>
          <div className="animate-card-in delay-3 mx-auto mt-8 max-w-xl rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-2" aria-hidden="true">
            <div className="flex rounded-xl bg-[var(--color-bg)] p-1">
              <div className="flex-1 rounded-lg bg-[var(--color-primary)] py-2.5 text-center text-sm font-bold text-white">
                Merchant
              </div>
              <div className="flex-1 py-2.5 text-center text-sm font-bold text-[var(--color-text-muted)]">
                Customer
              </div>
            </div>
            <p className="px-4 py-3 text-center text-xs text-[var(--color-text-muted)]">Switch roles anytime — one account, two sides of trade.</p>
          </div>
        </div>
      </section>

      <section id="offline" className="bg-[var(--color-surface)] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeader label={t.offline.label} title={t.offline.title} sub={t.offline.sub} />
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
              <p className="text-sm font-medium leading-relaxed text-[var(--color-text)]">{t.offline.pwa}</p>
            </div>
            <div className="animate-card-in rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg)] p-8">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  {featureIconMap.offline}
                </div>
                <div>
                  <p className="font-bold text-[var(--color-text)]">Offline mode</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Entries staged · syncs when online</p>
                </div>
              </div>
              <div className="space-y-3">
                {["Entry saved locally", "Waiting for network...", "Synced — no duplicates"].map((line, i) => (
                  <div key={line} className="flex items-center gap-3 rounded-xl bg-[var(--color-surface)] px-4 py-3 text-sm">
                    <span className={`h-2 w-2 rounded-full ${i < 2 ? "bg-[var(--color-accent)]" : "bg-[var(--color-primary)]"}`} />
                    <span className={i === 2 ? "font-medium text-[var(--color-primary-dark)]" : "text-[var(--color-text-muted)]"}>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="security" className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeader label={t.security.label} title={t.security.title} />
          <ul className="mx-auto grid max-w-3xl gap-4">
            {t.security.bullets.map((bullet, i) => (
              <li key={bullet} className={`animate-card-in ${i > 0 ? "delay-2" : ""} flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5`}>
                <span className="mt-0.5 text-[var(--color-primary)]">{Icons.check}</span>
                <span className="text-[var(--color-text)]">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="pricing" className="bg-[var(--color-surface)] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeader label={t.pricing.label} title={t.pricing.title} sub={t.pricing.framing} />
          <p className="-mt-8 mb-10 text-center text-sm font-semibold text-[var(--color-primary-dark)]">{t.pricing.freeForever}</p>
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
            {t.pricing.packages.map((pkg, i) => (
              <div
                key={pkg.price}
                className={`animate-card-in ${i === 1 ? "delay-2" : i === 2 ? "delay-3" : "delay-1"} relative rounded-[var(--radius-card)] border p-8 text-center ${
                  "popular" in pkg && pkg.popular
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-lg"
                    : "border-[var(--color-border)] bg-[var(--color-bg)]"
                }`}
              >
                {"popular" in pkg && pkg.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-bold text-white">
                    Popular
                  </span>
                )}
                <p className="text-3xl font-extrabold text-[var(--color-text)]">{pkg.price}</p>
                <p className="mt-2 text-lg font-bold text-[var(--color-primary-dark)]">{pkg.sms}</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">SMS reminders</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-[var(--color-text-muted)]">{t.pricing.footnote}</p>
          <div className="mt-8 text-center">
            <a href={LOGIN} className="btn-bounce inline-flex items-center gap-2 rounded-[var(--radius-button)] bg-[var(--color-primary-surface)] px-8 py-4 text-lg font-bold text-[var(--color-primary-foreground)] shadow-lg transition-all hover:bg-[var(--color-primary-surface-hover)] active:scale-[0.98]">
              {t.nav.startFree}
              {Icons.arrow}
            </a>
          </div>
        </div>
      </section>

      <section id="faq" className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <SectionHeader label={t.faq.label} title={t.faq.title} />
          <div className="space-y-3">
            {faqItems.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q.en} className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    onClick={() => setOpenFaq(open ? null : i)}
                    aria-expanded={open}
                  >
                    <span className="font-bold text-[var(--color-text)]">{item.q[lang]}</span>
                    <span className={`text-[var(--color-text-muted)] ${open ? "rotate-180" : ""}`}>{Icons.chevron}</span>
                  </button>
                  {open && (
                    <div className="border-t border-[var(--color-border)] px-5 py-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
                      {item.a[lang]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <SessionBlock t={t.session} />

      <section className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary-surface)] to-[var(--color-primary-surface-dark)] py-20 text-[var(--color-primary-foreground)] sm:py-28">
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">{t.cta.title}</h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85">{t.cta.sub}</p>
          <a
            href={LOGIN}
            className="mt-10 inline-flex items-center gap-2 rounded-[var(--radius-button)] bg-white px-8 py-4 text-lg font-bold text-[var(--color-primary-dark)] shadow-xl transition-all hover:bg-white/95 active:scale-[0.98] dark:bg-[var(--color-surface)] dark:text-[var(--color-primary)]"
          >
            {t.cta.button}
            {Icons.arrow}
          </a>
        </div>
      </section>

      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="mb-4 flex items-center gap-2.5">
                <LogoWithAbout size={36} showAnimation={false} onClick={() => setAboutOpen(true)} />
                <span className="text-lg font-extrabold text-[var(--color-text)]">QR Hisab</span>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-[var(--color-text-muted)]">{t.footer.tagline}</p>
              <p className="mt-4 text-xs text-[var(--color-text-muted)]">{t.footer.pwaHint}</p>
            </div>
            <div>
              <h4 className="mb-3 font-bold text-[var(--color-text)]">{t.footer.product}</h4>
              <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="transition-colors hover:text-[var(--color-primary)]">
                      {link.label}
                    </a>
                  </li>
                ))}
                <li>
                  <a href={LOGIN} className="transition-colors hover:text-[var(--color-primary)]">
                    {t.nav.startFree}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 font-bold text-[var(--color-text)]">{t.footer.legal}</h4>
              <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
                {[t.footer.privacy, t.footer.terms, t.footer.refund].map((label) => (
                  <li key={label}>
                    <span className="cursor-default" title={t.footer.comingSoon}>
                      {label} <span className="text-xs opacity-70">({t.footer.comingSoon})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-[var(--color-border)] pt-8 sm:flex-row">
            <p className="text-sm text-[var(--color-text-muted)]">&copy; {new Date().getFullYear()} QR Hisab</p>
            <LangToggle lang={lang} setLang={setLang} />
          </div>
        </div>
      </footer>

      <AboutSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}
