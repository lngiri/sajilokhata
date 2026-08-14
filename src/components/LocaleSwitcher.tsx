"use client";

import { usePathname, useRouter } from "next/navigation";

const LOCALE_COOKIE = "qr_hisab_locale";
const LOCALES = ["en", "ne"] as const;

function setCookie(name: string, value: string, days: number) {
  document.cookie = `${name}=${value};path=/;max-age=${days * 86400};SameSite=Lax;Secure`;
}

export default function LocaleSwitcher() {
  const pathname = usePathname();
  const router = useRouter();

  const currentLocale = LOCALES.find(
    (loc) => pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)
  );
  const nextLocale = currentLocale === "en" ? "ne" : "en";

  function switchLocale() {
    setCookie(LOCALE_COOKIE, nextLocale, 365);
    const rest = currentLocale
      ? pathname.slice(currentLocale.length + 1)
      : pathname;
    router.replace(`/${nextLocale}${rest || "/"}`);
  }

  return (
    <button
      onClick={switchLocale}
      className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 text-xs font-bold"
      aria-label={`Switch to ${nextLocale === "en" ? "English" : "Nepali"}`}
    >
      <span
        className={`rounded-full px-2.5 py-1 transition-colors ${
          currentLocale === "en"
            ? "bg-[var(--color-primary)] text-white"
            : "text-[var(--color-text-muted)]"
        }`}
      >
        EN
      </span>
      <span
        className={`rounded-full px-2.5 py-1 transition-colors ${
          currentLocale === "ne"
            ? "bg-[var(--color-primary)] text-white"
            : "text-[var(--color-text-muted)]"
        }`}
      >
        ने
      </span>
    </button>
  );
}
