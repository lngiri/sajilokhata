"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import LogoWithAbout from "@/components/LogoWithAbout";
import AboutSheet from "@/components/AboutSheet";

/* ─── IntersectionObserver hook for scroll animations ─── */
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
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    const timer = setTimeout(() => {
      document.querySelectorAll(".animate-card-in").forEach((el) => observer.observe(el));
    }, 100);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, []);
}

/* ─── Animated counter hook ─── */
function useCountUp(target: number, duration = 1500) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) rafRef.current = requestAnimationFrame(animate);
          };
          rafRef.current = requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    observerRef.current.observe(el);
    return () => {
      observerRef.current?.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return { ref, count };
}

type SessionInfo = {
  hasMerchant: boolean;
  hasCustomer: boolean;
  merchantPhone?: string;
  customerPhone?: string;
  customerName?: string;
};

/* ─── Hand-drawn doodle SVGs ─── */
const Doodles = {
  leaf: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 35c0 0-12-5-15-18C5 12 12 5 20 5c8 0 15 7 15 12 0 13-15 18-15 18z" stroke="#22C55E" fill="#22C55E20" />
      <path d="M20 35V10" stroke="#22C55E" />
      <path d="M12 18c4 0 6 2 8 5" stroke="#22C55E" />
      <path d="M28 16c-4 1-6 3-8 6" stroke="#22C55E" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 4l3 9h9l-7 5 3 9-8-6-8 6 3-9-7-5h9z" stroke="#F59E0B" fill="#F59E0B20" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16" cy="16" r="12" stroke="#22C55E" fill="#22C55E15" />
      <path d="M10 16l4 4 8-8" stroke="#22C55E" />
    </svg>
  ),
  qr: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="12" height="12" rx="2" stroke="#16A34A" fill="#16A34A15" />
      <rect x="24" y="4" width="12" height="12" rx="2" stroke="#16A34A" fill="#16A34A15" />
      <rect x="4" y="24" width="12" height="12" rx="2" stroke="#16A34A" fill="#16A34A15" />
      <rect x="7" y="7" width="6" height="6" rx="1" fill="#16A34A" opacity="0.3" />
      <rect x="27" y="7" width="6" height="6" rx="1" fill="#16A34A" opacity="0.3" />
      <rect x="7" y="27" width="6" height="6" rx="1" fill="#16A34A" opacity="0.3" />
      <rect x="24" y="24" width="4" height="4" fill="#16A34A" opacity="0.2" />
      <rect x="30" y="24" width="6" height="4" fill="#16A34A" opacity="0.2" />
      <rect x="24" y="30" width="4" height="6" fill="#16A34A" opacity="0.2" />
      <rect x="30" y="30" width="6" height="6" fill="#16A34A" opacity="0.2" />
    </svg>
  ),
  smile: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="20" cy="20" r="16" stroke="#F59E0B" fill="#F59E0B15" />
      <path d="M13 17c1-1 2.5-1 3.5 0" stroke="#F59E0B" />
      <path d="M23.5 17c1-1 2.5-1 3.5 0" stroke="#F59E0B" />
      <path d="M13 25c2 3 10 3 14 0" stroke="#F59E0B" />
    </svg>
  ),
  coffee: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 16h20v14c0 3-4 6-10 6s-10-3-10-6V16z" stroke="#78716C" fill="#78716C10" />
      <path d="M28 20h4c2 0 4 1 4 4s-2 4-4 4h-4" stroke="#78716C" />
      <path d="M14 6v6" stroke="#F59E0B" strokeLinecap="round" />
      <path d="M20 4v8" stroke="#F59E0B" strokeLinecap="round" />
      <path d="M26 6v6" stroke="#F59E0B" strokeLinecap="round" />
    </svg>
  ),
  receipt: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h24v28l-4-3-4 3-4-3-4 3-4-3-4 3V4z" stroke="#78716C" fill="#78716C10" />
      <path d="M13 12h14" stroke="#78716C" opacity="0.5" />
      <path d="M13 18h14" stroke="#78716C" opacity="0.5" />
      <path d="M13 24h8" stroke="#78716C" opacity="0.5" />
      <circle cx="28" cy="24" r="3" stroke="#22C55E" fill="#22C55E20" />
      <path d="M26.5 24l1 1 2.5-2.5" stroke="#22C55E" />
    </svg>
  ),
  notebook: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 4h22c1 0 2 1 2 2v28c0 1-1 2-2 2H10c-1 0-2-1-2-2V6c0-1 1-2 2-2z" stroke="#78716C" fill="#78716C10" />
      <path d="M16 4v36" stroke="#78716C" opacity="0.3" />
      <path d="M20 12h10" stroke="#78716C" opacity="0.4" />
      <path d="M20 18h10" stroke="#78716C" opacity="0.4" />
      <path d="M20 24h6" stroke="#78716C" opacity="0.4" />
    </svg>
  ),
  store: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 36V16l12-10 12 10v20" stroke="#16A34A" fill="#16A34A10" />
      <path d="M14 36V22h12v14" stroke="#16A34A" />
      <path d="M4 16l16-12 16 12" stroke="#16A34A" fill="none" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="14" cy="14" r="5" stroke="#78716C" fill="#78716C10" />
      <path d="M4 32c0-5 4-9 10-9s10 4 10 9" stroke="#78716C" fill="#78716C10" />
      <circle cx="28" cy="12" r="4" stroke="#16A34A" fill="#16A34A10" />
      <path d="M28 23c4 0 8 3 8 7" stroke="#16A34A" fill="#16A34A10" />
    </svg>
  ),
};

/* ─── Icons (inline SVGs) ─── */
const Icons = {
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
    <svg className="w-4 h-4 fill-[var(--color-accent)] text-[var(--color-accent)]" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  ),
  store: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
    </svg>
  ),
  users: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
};

/* ─── Floating doodle decoration ─── */
function FloatingDoodle({ doodle, className }: { doodle: React.ReactNode; className: string }) {
  return (
    <div className={`absolute pointer-events-none opacity-40 ${className}`}>
      {doodle}
    </div>
  );
}

/* ─── Animated stat counter component ─── */
function AnimatedStat({ value, label }: { value: string; label: string }) {
  // Extract the numeric part and the surrounding text for display
  const match = value.match(/([\d,.]+)/);
  const numericValue = match ? parseFloat(match[1].replace(/,/g, "")) : 0;
  const isDecimal = match && match[1].includes(".");
  const { ref, count } = useCountUp(isDecimal ? numericValue * 10 : Math.round(numericValue), 1500);
  const before = value.substring(0, value.indexOf(match?.[0] || ""));
  const after = value.substring(value.indexOf(match?.[0] || "") + (match?.[0]?.length || 0));
  const displayNum = isDecimal ? (count / 10).toFixed(1) : count.toLocaleString();
  return (
    <div ref={ref} className="text-center">
      <p className="text-3xl sm:text-4xl font-extrabold text-[var(--color-primary)] number-shine">
        {before}{displayNum}{after}
      </p>
      <p className="text-sm text-[var(--color-text-muted)] mt-1 font-medium">{label}</p>
    </div>
  );
}

export default function LandingPage() {
  useScrollReveal();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

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
  /*  DATA — Friendly, human, warm language                  */
  /* ──────────────────────────────────────────────────────── */
  const problems = [
    { title: "Notebooks get lost or torn", desc: "Physical khata books fall apart, get stolen, or just disappear. Your whole business history — gone.", doodle: Doodles.notebook },
    { title: "Customers forget what they owe", desc: "Without a system, people forget. And you lose money every single month.", doodle: Doodles.smile },
    { title: "Calculations take forever", desc: "Adding up columns by hand takes hours, and mistakes are inevitable.", doodle: Doodles.coffee },
    { title: "Nobody reminds them to pay", desc: "Customers don't pay on time because no one follows up. Cash flow suffers.", doodle: Doodles.receipt },
  ];

  const solutions = [
    { title: "Everything syncs to the cloud", desc: "Every transaction is safely stored. Access from any phone, anytime. Never lose data again.", doodle: Doodles.qr },
    { title: "See balances in one tap", desc: "Know exactly who owes what. No more guessing or flipping through pages.", doodle: Doodles.check },
    { title: "Math? We handle it.", desc: "Balances, totals, and summaries are calculated instantly. Zero errors, zero stress.", doodle: Doodles.star },
    { title: "Gentle SMS reminders", desc: "Send friendly payment reminders to customers. Get paid faster, without the awkwardness.", doodle: Doodles.leaf },
  ];

  const features = [
    { title: "Your Digital Khata", desc: "Replace your physical ledger with a secure digital credit system. Track every rupee with complete history.", doodle: Doodles.notebook, color: "text-[var(--color-primary)]", bg: "bg-[var(--color-primary)]/10 dark:bg-green-950/30" },
    { title: "QR Code Access", desc: "Customers scan your QR to see their balance. No app download needed — works in any browser.", doodle: Doodles.qr, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
    { title: "SMS Payment Reminders", desc: "Send automatic reminders via SMS. Keep your cash flow healthy with timely follow-ups.", doodle: Doodles.receipt, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30" },
    { title: "PIN Security", desc: "A simple 4-digit PIN keeps your account safe. Only you can see your business data.", doodle: Doodles.check, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30" },
    { title: "Live Dashboard", desc: "See today's cash, money to collect, and pending approvals — all updated in real-time.", doodle: Doodles.star, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-950/30" },
    { title: "Manage All Your Customers", desc: "Keep track of hundreds of customers. Set credit limits and see each relationship clearly.", doodle: Doodles.users, color: "text-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-950/30" },
  ];

  const useCases = [
    { title: "Kirana & Grocery Shops", desc: "Track daily credit sales to your regular customers. Send monthly balance summaries via SMS.", doodle: Doodles.store },
    { title: "Dairy & Repeat-Product Shops", desc: "Track quantity-based sales. Customers confirm digitally — no paper needed.", doodle: Doodles.coffee },
    { title: "Freelancers & Service Providers", desc: "Bill clients for projects. Track partial payments and outstanding invoices.", doodle: Doodles.receipt },
  ];

  const steps = [
    { num: "1", title: "Sign Up", desc: "Enter your phone number and set a 4-digit PIN. Takes less than a minute.", doodle: Doodles.check },
    { num: "2", title: "Add Your Customers", desc: "Import your existing customers or add them one by one. Set credit limits for each.", doodle: Doodles.users },
    { num: "3", title: "Start Selling", desc: "Record credit sales, accept payments, and grow your business — all from your phone.", doodle: Doodles.star },
  ];

  const testimonials = [
    { name: "Ramesh S.", role: "Kirana shop, Kathmandu", text: "I used to carry a notebook everywhere. Now I just open QR Hisab. My customers love seeing their balance instantly. It changed how I do business." },
    { name: "Sita D.", role: "Pharmacy, Pokhara", text: "The SMS reminders alone have recovered Rs. 50,000+ in forgotten debts. It's like having a helper who never forgets." },
    { name: "Ram K.", role: "Hardware store, Chitwan", text: "Managing 200+ customers was a nightmare. QR Hisab makes it feel effortless. I wish I'd found it sooner." },
  ];

  const stats = [
    { value: "5,000+", label: "Happy shop owners" },
    { value: "50,000+", label: "Customers tracked" },
    { value: "Rs. 10Cr+", label: "Credits managed" },
    { value: "4.8/5", label: "Love from users" },
  ];

  /* ──────────────────────────────────────────────────────── */
  /*  RENDER                                                  */
  /* ──────────────────────────────────────────────────────── */
  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      {/* ══════ NAVBAR ══════ */}
      <nav className="sticky top-0 z-50 bg-[var(--color-bg)]/80 backdrop-blur-lg border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoWithAbout size={36} showAnimation onClick={() => setAboutOpen(true)} className="p-1" />
            <span className="text-lg font-extrabold text-[var(--color-text)]">QR Hisab</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login?signedOut=1" className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors hidden sm:block">
              Log in
            </Link>            <Link
              href="/login?signedOut=1"
              className="btn-bounce px-5 py-2.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-[var(--radius-button)] text-sm font-bold hover:bg-[var(--color-primary-surface-hover)] transition-all active:scale-[0.97] shadow-sm"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ══════ HERO ══════ */}
      <section className="relative overflow-hidden">
        {/* Soft background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-[var(--color-primary)]/8 via-[var(--color-primary)]/4 to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* Floating doodles */}
        <FloatingDoodle doodle={Doodles.leaf} className="top-24 left-[8%] rotate-12 animate-pulse-soft" />
        <FloatingDoodle doodle={Doodles.star} className="top-32 right-[10%] -rotate-6 animate-bounce-subtle" />
        <FloatingDoodle doodle={Doodles.qr} className="bottom-20 left-[12%] rotate-6" />
        <FloatingDoodle doodle={Doodles.smile} className="bottom-32 right-[8%] -rotate-12" />
        <FloatingDoodle doodle={Doodles.coffee} className="top-48 left-[4%]" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 sm:pt-32 sm:pb-28">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)]/10 rounded-full mb-8 animate-entrance">
              <span className="text-lg">{Doodles.leaf}</span>
              <span className="text-sm font-semibold text-[var(--color-primary-dark)]">Made for Nepali shop owners</span>
            </div>

            {/* Headline — warm, human */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[var(--color-text)] tracking-tight leading-[1.15] animate-entrance-delay-1">
              Never lose a rupee
              <span className="block text-[var(--color-primary)] mt-2">to forgotten debts again</span>
            </h1>

            {/* Subheadline — friendly */}
            <p className="mt-6 text-lg sm:text-xl text-[var(--color-text-muted)] max-w-2xl mx-auto leading-relaxed animate-entrance-delay-2">
              Your digital khata for tracking credits, sending payment reminders,
              and growing your shop — all from your phone.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-entrance-delay-2">
              <Link
                href="/login?signedOut=1"
                className="btn-bounce w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-[var(--radius-button)] font-bold text-lg hover:bg-[var(--color-primary-surface-hover)] transition-all shadow-lg shadow-[var(--color-primary)]/20 hover:shadow-xl hover:shadow-[var(--color-primary)]/30 active:scale-[0.98]"
              >
                Start Free
                {Icons.arrow}
              </Link>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white dark:bg-[var(--color-surface)] text-[var(--color-text)] rounded-[var(--radius-button)] font-bold text-lg border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/5 transition-all active:scale-[0.98]"
              >
                See How It Works
              </a>
            </div>

            {/* Trust signals */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1.5">{Icons.check} Free for basic use</span>
              <span className="flex items-center gap-1.5">{Icons.check} Works on any phone</span>
              <span className="flex items-center gap-1.5">{Icons.check} No app download needed</span>
            </div>
          </div>

          {/* Hero visual — phone mockup */}
          <div className="mt-20 max-w-sm mx-auto animate-entrance-delay-2">
            <div className="relative bg-stone-950 dark:bg-stone-900 rounded-[2.5rem] p-2 shadow-2xl">
              <div className="bg-[var(--color-surface)] rounded-[2rem] overflow-hidden">
                {/* Phone status bar */}
                <div className="h-10 bg-[var(--color-primary-surface)] flex items-center justify-between px-6">
                  <span className="text-xs font-semibold text-white/80">9:41</span>
                  <span className="text-xs font-bold text-white">QR Hisab</span>
                  <span className="text-xs text-white/80">●●●</span>
                </div>
                {/* Dashboard preview */}
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/15 flex items-center justify-center">
                      <span className="text-sm font-bold text-[var(--color-primary)]">R</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--color-text)]">Ramesh&apos;s Shop</p>
                      <p className="text-xs text-[var(--color-text-muted)]">How&apos;s business today? 👋</p>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-[var(--color-primary-surface)] to-[var(--color-primary-surface-dark)] rounded-[var(--radius-card)] p-4 text-[var(--color-primary-foreground)]">
                    <p className="text-xs opacity-80">Money to Collect</p>
                    <p className="text-2xl font-extrabold mt-1">Rs. 45,200</p>
                    <p className="text-xs opacity-60 mt-1">From 23 customers</p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: "Sita Devi", amount: "Rs. 3,500", emoji: "🛒" },
                      { name: "Ram Bahadur", amount: "Rs. 2,100", emoji: "🔧" },
                      { name: "Gita Store", amount: "Rs. 800", emoji: "🏪" },
                    ].map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-[var(--color-bg)] rounded-[var(--radius-button)]">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{c.emoji}</span>
                          <span className="text-sm font-medium text-[var(--color-text)]">{c.name}</span>
                        </div>
                        <span className="text-xs font-bold text-[var(--color-primary-dark)] bg-[var(--color-primary)]/10 px-2.5 py-1 rounded-full">{c.amount}</span>
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
      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <AnimatedStat key={i} value={s.value} label={s.label} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════ PROBLEM / SOLUTION ══════ */}
      <section className="py-24 sm:py-32 relative">
        <FloatingDoodle doodle={Doodles.notebook} className="top-10 right-[5%] rotate-12" />
        <FloatingDoodle doodle={Doodles.check} className="bottom-10 left-[5%] -rotate-6" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <p className="text-sm font-bold text-[var(--color-primary)] uppercase tracking-wider mb-3">Your notebook can&apos;t do this ✨</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--color-text)]">
              Say goodbye to paper khata
            </h2>
            <p className="mt-4 text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto">
              Traditional khata books are outdated. QR Hisab solves the real problems Nepali shop owners face every day.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Problems */}
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-red-50 dark:bg-red-950/30 rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[var(--color-text)]">Without QR Hisab 😓</h3>
              </div>
              <div className="space-y-4">
                {problems.map((p, i) => (
                  <div key={i} className="animate-card-in p-5 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50 rounded-[var(--radius-card)] flex gap-4">
                    <span className="text-2xl flex-shrink-0 mt-0.5 opacity-60">{p.doodle}</span>
                    <div>
                      <p className="font-bold text-[var(--color-text)] text-sm">{p.title}</p>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Solutions */}
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-[var(--color-primary)]/10 rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[var(--color-text)]">With QR Hisab 😊</h3>
              </div>
              <div className="space-y-4">
                {solutions.map((s, i) => (
                  <div key={i} className="animate-card-in p-5 bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 rounded-[var(--radius-card)] flex gap-4">
                    <span className="text-2xl flex-shrink-0 mt-0.5">{s.doodle}</span>
                    <div>
                      <p className="font-bold text-[var(--color-text)] text-sm">{s.title}</p>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ TARGET AUDIENCE ══════ */}
      <section className="py-24 sm:py-32 bg-[var(--color-surface)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-bold text-[var(--color-primary)] uppercase tracking-wider mb-3">Built for local businesses 💛</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--color-text)]">
              Small shops deserve big tools
            </h2>
            <p className="mt-4 text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto">
              Whether you run a kirana shop, dairy, or service business — QR Hisab adapts to how you work.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {useCases.map((uc, i) => (
              <div key={i} className={`animate-card-in ${i === 0 ? "delay-1" : i === 1 ? "delay-2" : "delay-3"} bg-[var(--color-surface)] rounded-[var(--radius-card)] p-8 border border-[var(--color-border)] hover:shadow-lg hover:border-[var(--color-primary)]/20 transition-all group`}>
                <div className="w-14 h-14 bg-[var(--color-primary)]/10 rounded-2xl flex items-center justify-center mb-5 text-2xl group-hover:scale-110 transition-transform">
                  {uc.doodle}
                </div>
                <h3 className="text-xl font-bold text-[var(--color-text)] mb-2">{uc.title}</h3>
                <p className="text-[var(--color-text-muted)] leading-relaxed">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ FEATURES ══════ */}
      <section className="py-24 sm:py-32 relative">
        <FloatingDoodle doodle={Doodles.star} className="top-16 left-[3%] -rotate-12" />
        <FloatingDoodle doodle={Doodles.qr} className="bottom-16 right-[3%] rotate-6" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-bold text-[var(--color-primary)] uppercase tracking-wider mb-3">Everything you need ✨</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--color-text)]">
              Simple tools for your shop
            </h2>
            <p className="mt-4 text-lg text-[var(--color-text-muted)]">
              No complicated menus. No training needed. Just open and use.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className={`animate-card-in ${i % 3 === 0 ? "delay-1" : i % 3 === 1 ? "delay-2" : "delay-3"} bg-[var(--color-surface)] rounded-[var(--radius-card)] p-7 border border-[var(--color-border)] hover:shadow-lg hover:border-[var(--color-primary)]/20 transition-all group`}>
                <div className={`w-14 h-14 ${f.bg} rounded-2xl flex items-center justify-center mb-5 ${f.color} group-hover:scale-110 transition-transform`}>
                  {f.doodle}
                </div>
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">{f.title}</h3>
                <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ HOW IT WORKS ══════ */}
      <section id="how-it-works" className="py-24 sm:py-32 bg-stone-900 dark:bg-stone-800 text-[var(--color-primary-foreground)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-bold text-[var(--color-primary-light)] uppercase tracking-wider mb-3">Get started in 3 steps 🚀</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold">
              Ready in under a minute
            </h2>
            <p className="mt-4 text-lg text-gray-400">
              No training needed. If you can use a phone, you can use QR Hisab.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-14 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-[var(--color-primary)]/30 via-[var(--color-primary)] to-[var(--color-primary)]/30" />

            {steps.map((s, i) => (
              <div key={i} className="text-center relative">
                <div className="w-28 h-28 bg-[var(--color-primary-surface)] rounded-full flex items-center justify-center mx-auto mb-6 text-4xl font-extrabold relative z-10 shadow-lg shadow-[var(--color-primary)]/30">
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
      <section className="py-24 sm:py-32 relative">
        <FloatingDoodle doodle={Doodles.smile} className="top-12 right-[6%] rotate-12" />
        <FloatingDoodle doodle={Doodles.leaf} className="bottom-12 left-[6%] -rotate-6" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-bold text-[var(--color-primary)] uppercase tracking-wider mb-3">Loved by shop owners 💚</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--color-text)]">
              Real stories from real shops
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className={`animate-card-in ${i === 0 ? "delay-1" : i === 1 ? "delay-2" : "delay-3"} bg-[var(--color-surface)] rounded-[var(--radius-card)] p-7 border border-[var(--color-border)] hover:shadow-lg transition-shadow`}>
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, j) => <span key={j}>{Icons.star}</span>)}
                </div>
                <p className="text-[var(--color-text)] leading-relaxed mb-6 text-sm">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-[var(--color-primary)]">{t.name[0]}</span>
                  </div>
                  <div>
                    <p className="font-bold text-[var(--color-text)] text-sm">{t.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ SESSION CARDS / SIGN IN ══════ */}
      {hasAnySession && (
        <section className="py-16 bg-[var(--color-surface)]">
          <div className="max-w-lg mx-auto px-4">
            <div className="bg-[var(--color-surface)] rounded-[var(--radius-dialog)] shadow-lg border border-[var(--color-border)] p-6 sm:p-8 space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-xl font-extrabold text-[var(--color-text)]">Welcome back! 👋</h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">Choose an account to continue</p>
              </div>

              {session?.hasMerchant && (
                <button
                  onClick={() => handleContinue("merchant")}
                  disabled={!!redirecting}
                  className="w-full p-4 bg-gradient-to-r from-blue-50 dark:from-blue-950/30 dark:to-[var(--color-surface)] rounded-[var(--radius-button)] border border-blue-100 dark:border-blue-900/50 hover:border-blue-300 hover:shadow-md active:scale-[0.98] transition-all flex items-center gap-4 text-left disabled:opacity-60"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600">{Icons.store}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[var(--color-text)]">Continue as Merchant</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{maskPhone(session.merchantPhone)}</p>
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
                  className="w-full p-4 bg-gradient-to-r from-[var(--color-primary)]/5 dark:to-[var(--color-surface)] rounded-[var(--radius-button)] border border-[var(--color-primary)]/15 hover:border-[var(--color-primary)]/40 hover:shadow-md active:scale-[0.98] transition-all flex items-center gap-4 text-left disabled:opacity-60"
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[var(--color-primary)]">{Icons.users}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[var(--color-text)]">Continue as Customer</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {session.customerName ? `${session.customerName} · ` : ""}{maskPhone(session.customerPhone)}
                    </p>
                  </div>
                  {redirecting === "customer" ? (
                    <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-gray-300">{Icons.arrow}</span>
                  )}
                </button>
              )}

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--color-border)]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-[var(--color-surface)] text-[var(--color-text-muted)]">or</span>
                </div>
              </div>

              <button
                onClick={handleDifferentAccount}
                className="w-full py-3 text-sm font-bold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors rounded-xl hover:bg-[var(--color-primary)]/5 active:scale-[0.98]"
              >
                Sign in with a different account
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ══════ FINAL CTA ══════ */}
      <section className="py-24 sm:py-32 bg-gradient-to-br from-[var(--color-primary-surface)] to-[var(--color-primary-surface-dark)] text-[var(--color-primary-foreground)] relative overflow-hidden">
        <FloatingDoodle doodle={Doodles.star} className="top-10 left-[10%] rotate-12 opacity-30" />
        <FloatingDoodle doodle={Doodles.leaf} className="bottom-10 right-[10%] -rotate-12 opacity-30" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold">
            Ready to go digital? 🌱
          </h2>
          <p className="mt-6 text-lg sm:text-xl text-white/80 max-w-2xl mx-auto">
            Join thousands of merchants who have transformed their business with QR Hisab.
            Start in under 60 seconds — it&apos;s free!
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login?signedOut=1"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white dark:bg-[var(--color-surface)] text-[var(--color-primary-dark)] rounded-[var(--radius-button)] font-bold text-lg hover:bg-white/90 dark:hover:bg-[var(--color-surface)] transition-all shadow-xl active:scale-[0.98]"
            >
              Start Using QR Hisab
              {Icons.arrow}
            </Link>
          </div>
          <p className="mt-6 text-sm text-white/50">No credit card required · Free for basic use · Works on any phone</p>
        </div>
      </section>

      {/* ══════ FOOTER — Friendly, warm ══════ */}
      <footer className="border-t border-[var(--color-border)] bg-white dark:bg-[var(--color-surface)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <LogoWithAbout size={36} showAnimation={false} onClick={() => setAboutOpen(true)} />
                <span className="text-lg font-extrabold text-[var(--color-text)]">QR Hisab</span>
              </div>
              <p className="text-sm text-[var(--color-text-muted)] max-w-sm leading-relaxed">
                Your friendly digital khata for tracking credits, managing customers,
                and growing your small business — made with ❤️ in Nepal.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-bold text-[var(--color-text)] mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
                <li><a href="#how-it-works" className="hover:text-[var(--color-primary)] transition-colors">How It Works</a></li>
                <li><Link href="/login?signedOut=1" className="hover:text-[var(--color-primary)] transition-colors">Get Started</Link></li>
                <li><Link href="/login?signedOut=1" className="hover:text-[var(--color-primary)] transition-colors">Login</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-[var(--color-text)] mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
                <li><span className="cursor-default">Privacy Policy</span></li>
                <li><span className="cursor-default">Terms of Service</span></li>
                <li><span className="cursor-default">Refund Policy</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-[var(--color-border)] flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-[var(--color-text-muted)]">&copy; {new Date().getFullYear()} QR Hisab. All rights reserved.</p>
            <p className="text-sm text-[var(--color-text-muted)]">Made with ❤️ in Nepal 🇳🇵</p>
          </div>
        </div>
      </footer>

      <AboutSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}
