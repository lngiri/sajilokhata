export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6">
      <div className="text-6xl font-bold text-gray-200 mb-4">404</div>
      <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">
        Page Not Found
      </h2>
      <p className="text-sm text-[var(--color-text-muted)] text-center mb-6">
        The page you are looking for does not exist.
      </p>
      <a
        href="/"
        className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium active:scale-[0.98] transition-transform"
      >
        Go Home
      </a>
    </div>
  );
}
