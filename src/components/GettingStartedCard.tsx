"use client";

interface Props {
  onDismiss: () => void;
}

const STEPS = [
  {
    num: "1",
    title: "Set up your shop",
    body: "Add your shop name, address, and business type so customers recognise you.",
    href: "/merchant/settings",
  },
  {
    num: "2",
    title: "Add your products",
    body: "List what you sell — customers can pick items when they request credit.",
    href: "/merchant/products",
  },
  {
    num: "3",
    title: "Record your first entry",
    body: "When a customer buys on credit, tap New Entry and log it in seconds.",
    href: "/merchant/scan?manual=true",
  },
];

export default function GettingStartedCard({ onDismiss }: Props) {
  return (
    <div
      data-testid="getting-started-card"
      className="bg-gradient-to-br from-blue-50 dark:from-blue-900/20 to-indigo-50 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 shadow-sm"
    >
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold text-[var(--color-text)]">Welcome to QR Hisab 👋</h2>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss getting started"
          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-white/60 dark:hover:bg-gray-800/60 transition-colors active:scale-90"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mb-3">
        Here&apos;s how to get started — tap a step:
      </p>
      <div className="space-y-2">
        {STEPS.map((s) => (
          <a
            key={s.num}
            href={s.href}
            className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800/60 rounded-xl border border-blue-100 dark:border-blue-900 active:scale-[0.98] transition-transform"
          >
            <span className="w-7 h-7 rounded-full bg-[var(--color-primary)] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
              {s.num}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text)]">{s.title}</p>
              <p className="text-[11px] text-[var(--color-text-muted)] leading-snug">{s.body}</p>
            </div>
            <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  );
}
