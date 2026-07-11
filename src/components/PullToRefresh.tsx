"use client";

import { useRef, useState, useCallback, type ReactNode } from "react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  /** Minimum pull distance in px to trigger refresh (default: 80) */
  threshold?: number;
  /** Maximum pull distance in px (default: 120) */
  maxPull?: number;
}

export default function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  maxPull = 120,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // Only activate pull-to-refresh when scrolled to top
      if (window.scrollY > 0) return;
      // Only respond to single-finger downward drag
      if (e.touches.length !== 1) return;

      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    },
    []
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pullingRef.current || refreshing) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;

      // Only respond to downward pulls
      if (diff <= 0) {
        setPullDistance(0);
        return;
      }

      // Prevent native overscroll when actively pulling
      e.preventDefault();

      // Apply resistance so it feels natural (drag feels heavier the further you pull)
      const resisted = Math.min(diff * 0.4, maxPull);
      setPullDistance(resisted);
    },
    [refreshing, maxPull]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current || refreshing) return;
    pullingRef.current = false;

    if (pullDistance >= threshold) {
      // Trigger refresh
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Snap back
      setPullDistance(0);
    }
  }, [pullDistance, threshold, refreshing, onRefresh]);

  const progress = Math.min(pullDistance / threshold, 1);
  const isReady = pullDistance >= threshold && !refreshing;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative overflow-hidden"
    >
      {/* Refresh indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center transition-all duration-200 ease-out"
        style={{
          top: -60 + pullDistance * (60 / threshold),
          opacity: Math.min(pullDistance / 20, 1),
          height: 60,
        }}
      >
        {refreshing ? (
          <div className="flex flex-col items-center gap-1">
            <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] text-[var(--color-primary)] font-medium">
              Refreshing...
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <svg
              className="w-6 h-6 text-[var(--color-primary)] transition-transform duration-200"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              style={{
                transform: `rotate(${isReady ? 180 : progress * 180}deg)`,
              }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
            <span className="text-[10px] text-[var(--color-primary)] font-medium">
              {isReady ? "Release to refresh" : "Pull to refresh"}
            </span>
          </div>
        )}
      </div>

      {/* Content wrapper — translates down with the pull */}
      <div
        className="transition-transform duration-200 ease-out"
        style={{
          transform: refreshing
            ? `translateY(60px)`
            : pullDistance > 0
            ? `translateY(${pullDistance}px)`
            : "translateY(0)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
