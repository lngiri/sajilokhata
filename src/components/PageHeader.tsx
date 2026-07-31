"use client";

interface PageHeaderProps {
  title: string;
  backHref: string;
  backLabel?: string;
  rightSlot?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  backHref,
  backLabel = "Back",
  rightSlot,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={`sticky top-0 z-40 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-[var(--color-border)] ${className}`}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center min-w-0">
          <a href={backHref} aria-label={backLabel} className="mr-3 p-1 active:scale-95 transition-transform">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <h1 className="text-lg font-bold text-[var(--color-text)] truncate">{title}</h1>
        </div>
        {rightSlot}
      </div>
    </div>
  );
}
