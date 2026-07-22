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
        {/* Logo with draw animation */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <svg viewBox="0 0 36 36" className="absolute inset-0 w-20 h-20" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="10" height="10" rx="2" className="animate-draw" style={{ animationDelay: '0s' }} />
            <rect x="22" y="4" width="10" height="10" rx="2" className="animate-draw" style={{ animationDelay: '0.3s' }} />
            <rect x="4" y="22" width="10" height="10" rx="2" className="animate-draw" style={{ animationDelay: '0.6s' }} />
            <circle cx="27" cy="27" r="2" className="animate-draw" style={{ animationDelay: '0.9s' }} />
            <circle cx="18" cy="18" r="1.5" className="animate-draw" style={{ animationDelay: '1.0s' }} />
          </svg>
          <img src="/icons/logo.png" alt="" className="absolute inset-0 w-20 h-20 rounded-2xl object-contain shadow-lg animate-fade-in" style={{ animationDelay: '0.8s' }} />
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
