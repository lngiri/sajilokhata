import LogoWithAbout from "@/components/LogoWithAbout";

export default function NotFound() {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-dvh px-6 bg-[var(--color-bg)]">
      {/* Doodle decorations */}
      <div className="absolute top-20 left-[10%] opacity-20 pointer-events-none">
        <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 35c0 0-12-5-15-18C5 12 12 5 20 5c8 0 15 7 15 12 0 13-15 18-15 18z" stroke="#22C55E" fill="#22C55E20" />
          <path d="M20 35V10" stroke="#22C55E" />
        </svg>
      </div>
      <div className="absolute bottom-20 right-[10%] opacity-20 pointer-events-none">
        <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 4l3 9h9l-7 5 3 9-8-6-8 6 3-9-7-5h9z" stroke="#F59E0B" fill="#F59E0B20" />
        </svg>
      </div>

      <div className="relative text-center">
        <div className="mx-auto mb-6">
          <LogoWithAbout size={80} showAnimation />
        </div>

        <div className="text-6xl font-extrabold text-[var(--color-border)] mb-4">404</div>
        <h2 className="text-xl font-extrabold text-[var(--color-text)] mb-2">
          Oops! This page wandered off 😅
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] text-center mb-8 max-w-xs mx-auto">
          The page you are looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back on track!
        </p>
        <a
          href="/"
          className="px-8 py-3.5 bg-[var(--color-primary)] text-white rounded-[var(--radius-button)] font-bold active:scale-[0.98] transition-transform shadow-sm inline-block"
        >
          Take Me Home 🏠
        </a>
      </div>
    </div>
  );
}
