"use client";

import { useState, useEffect } from "react";
import { getPendingLogs, isOnline, onOnlineStatusChange, getDeliveryLogs } from "@/lib/offline/db";

export default function OfflineIndicator() {
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const updateCount = async () => {
      const [creditLogs, deliveryLogs] = await Promise.all([getPendingLogs(), getDeliveryLogs()]);
      setPendingCount(creditLogs.length + deliveryLogs.length);
    };
    updateCount();
    setOnline(isOnline());

    const interval = setInterval(updateCount, 5000);
    const unsubscribe = onOnlineStatusChange((status) => {
      setOnline(status);
      if (status) {
        setSyncing(true);
        updateCount().finally(() => setSyncing(false));
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  if (pendingCount === 0 && online) return null;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
        syncing
          ? "bg-blue-50 border-blue-200"
          : online
            ? "bg-green-50 border-green-200"
            : "bg-amber-50 border-amber-200"
      }`}
    >
      {syncing ? (
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-spin border-2 border-blue-200 border-t-blue-500" />
      ) : online ? (
        <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
      )}
      <span
        className={`text-xs font-medium ${
          syncing ? "text-blue-700" : online ? "text-green-700" : "text-amber-700"
        }`}
      >
        {syncing
          ? "Syncing..."
          : online
            ? "All synced"
            : `Offline Mode — ${pendingCount} item${pendingCount !== 1 ? "s" : ""} pending`}
      </span>
    </div>
  );
}
