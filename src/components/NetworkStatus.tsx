"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isOnline,
  onOnlineStatusChange,
  getPendingLogsCount,
  getLastSyncTime,
} from "@/lib/offline/db";
import { SYNC_COMPLETE_EVENT } from "@/components/OfflineSync";
import { PENDING_SAVE_EVENT } from "@/lib/offline/sync";

export default function NetworkStatus() {
  const [online, setOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const refreshSyncState = useCallback(async () => {
    try {
      const [count, last] = await Promise.all([getPendingLogsCount(), getLastSyncTime()]);
      setPendingCount(count);
      setLastSync(last);
    } catch {
      // IndexedDB unavailable — ignore
    }
  }, []);

  useEffect(() => {
    setOnline(isOnline());
    refreshSyncState();

    const unsubscribe = onOnlineStatusChange((status) => {
      setOnline(status);
      if (status) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 2500);
        refreshSyncState();
      }
    });

    const handleSyncComplete = () => refreshSyncState();
    const handlePendingSave = () => refreshSyncState();
    window.addEventListener(SYNC_COMPLETE_EVENT, handleSyncComplete);
    window.addEventListener(PENDING_SAVE_EVENT, handlePendingSave);

    return () => {
      unsubscribe();
      window.removeEventListener(SYNC_COMPLETE_EVENT, handleSyncComplete);
      window.removeEventListener(PENDING_SAVE_EVENT, handlePendingSave);
    };
  }, [refreshSyncState]);

  if (online && !showReconnected && pendingCount === 0) return null;

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

  if (online) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center py-1.5 text-xs font-medium animate-slide-down">
        <div className="flex items-center justify-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
          <span>{pendingCount} entr{pendingCount === 1 ? "y" : "ies"} waiting to sync{lastSync ? ` · last synced ${lastSync.toLocaleTimeString()}` : ""}</span>
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
