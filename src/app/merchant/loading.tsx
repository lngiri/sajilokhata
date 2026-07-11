export default function MerchantLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh pb-20">
      <div className="w-12 h-12 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm text-[var(--color-text-muted)]">Loading dashboard...</p>
    </div>
  );
}
