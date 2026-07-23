export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md mx-auto min-h-dvh overflow-x-hidden sm:my-4 sm:rounded-2xl sm:shadow-xl bg-[var(--color-bg)]">
      {children}
    </div>
  );
}
