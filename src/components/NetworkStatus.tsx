"use client";

import { useState, useEffect } from "react";
import { isOnline, onOnlineStatusChange } from "@/lib/offline/db";

export default function NetworkStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(isOnline());
    const unsubscribe = onOnlineStatusChange(setOnline);
    return unsubscribe;
  }, []);

  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center py-1.5 text-xs font-medium">
      <div className="flex items-center justify-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m-2.829-2.829a5 5 0 000-7.07m-4.243 2.121a1.5 1.5 0 012.122 0m2.121 2.121a1.5 1.5 0 010 2.122m-2.121-2.121a1.5 1.5 0 00-2.122 0M3.375 19.5h17.25" />
        </svg>
        Offline Mode — Data will sync when connected
      </div>
    </div>
  );
}
