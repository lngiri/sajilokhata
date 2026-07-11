"use client";

import { useState, useEffect } from "react";
import { getPendingLogs, isOnline, onOnlineStatusChange } from "@/lib/offline/db";

export default function OfflineIndicator() {
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const updateCount = async () => {
      const logs = await getPendingLogs();
      setPendingCount(logs.length);
    };
    updateCount();
    setOnline(isOnline());

    const interval = setInterval(updateCount, 5000);
    const unsubscribe = onOnlineStatusChange((status) => {
      setOnline(status);
      if (status) updateCount();
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  if (pendingCount === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full border border-amber-200">
      <div className={`w-2 h-2 rounded-full ${online ? "bg-green-500" : "bg-amber-500 animate-pulse"}`} />
      <span className="text-xs font-medium text-amber-700">
        {pendingCount} pending {pendingCount === 1 ? "entry" : "entries"}
      </span>
    </div>
  );
}
