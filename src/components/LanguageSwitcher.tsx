"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("common");

  const currentLocale = pathname.split("/")[1] || "en";
  const otherLocale = currentLocale === "en" ? "ne" : "en";

  const handleSwitch = useCallback(() => {
    const newPath = pathname.replace(`/${currentLocale}/`, `/${otherLocale}/`);
    router.push(newPath);
    router.refresh();
  }, [currentLocale, otherLocale, pathname, router]);

  return (
    <div className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 text-xs font-bold">
      <button
        type="button"
        onClick={handleSwitch}
        aria-pressed={currentLocale === "en"}
        className={`rounded-full px-3 py-1.5 transition-colors ${currentLocale === "en" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={handleSwitch}
        aria-pressed={currentLocale === "ne"}
        className={`rounded-full px-3 py-1.5 transition-colors ${currentLocale === "ne" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
      >
        ने
      </button>
    </div>
  );
}