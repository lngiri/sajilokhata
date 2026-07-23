export default function DashboardLoading() {
  return (
    <div className="pb-20">
      <div className="sticky top-0 z-40 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="space-y-1">
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-3 w-24 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          </div>
          <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
        </div>
      </div>
      <div className="px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
              <div className="h-3 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse mb-2" />
              <div className="h-6 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="h-20 bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)] animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border)] animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
