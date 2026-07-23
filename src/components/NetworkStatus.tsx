"use client";

import { useState, useEffect } from "react";
import { isOnline, onOnlineStatusChange } from "@/lib/offline/db";

export default function NetworkStatus() {
  const [online, setOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    setOnline(isOnline());
    const unsubscribe = onOnlineStatusChange((status) => {
      setOnline(status);
      if (status) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 2500);
      }
    });
    return unsubscribe;
  }, []);

  if (online && !showReconnected) return null;

  if (showReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] text-center py-1.5 text-xs font-medium animate-slide-down">
        <div className="flex items-center justify-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Connected!
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white text-center py-1.5 text-xs font-medium animate-slide-down">
      <div className="flex items-center justify-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        No Internet Connection. Reconnecting...
      </div>
    </div>
  );
}
