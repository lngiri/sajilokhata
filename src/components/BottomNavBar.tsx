"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: (active: boolean) => ReactNode;
  isFab?: boolean;
  dataTour?: string;
}

interface BottomNavBarProps {
  items: NavItem[];
  isActive: (href: string) => boolean;
  navLabel: string;
  fabLabel?: string;
  onFabClick?: () => void;
}

/**
 * Shared fixed bottom navigation bar used by both merchant and customer apps.
 * Handles safe-area padding, top border, active-link state and aria attributes
 * consistently so the two navs can't drift apart.
 */
export default function BottomNavBar({
  items,
  isActive,
  navLabel,
  fabLabel,
  onFabClick,
}: BottomNavBarProps) {
  return (
    <nav
      aria-label={navLabel}
      className="fixed bottom-0 left-0 right-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div
        className="grid items-center max-w-md mx-auto h-16"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          if (item.isFab) {
            return (
              <button
                key={item.label}
                type="button"
                onClick={onFabClick}
                aria-label={fabLabel}
                data-tour={item.dataTour}
                className="flex flex-col items-center justify-center w-full h-full gap-0.5 active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 -mt-4 rounded-full bg-gradient-to-br from-[var(--color-primary-surface)] to-[var(--color-primary-surface-dark)] shadow-lg flex items-center justify-center ring-4 ring-[var(--color-bg)]">
                  {item.icon(true)}
                </div>
                <span className="text-[10px] font-medium text-[var(--color-primary)] -mt-0.5">
                  {item.label}
                </span>
              </button>
            );
          }

          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              data-tour={item.dataTour}
              className="flex flex-col items-center justify-center w-full h-full gap-0.5 active:scale-95 transition-transform"
            >
              {item.icon(active)}
              <span className={`text-[10px] font-medium ${active ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
