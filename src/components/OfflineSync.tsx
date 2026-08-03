"use client";

import { useEffect, useRef } from "react";
import { syncOnce } from "@/lib/offline/sync";
import { onOnlineStatusChange } from "@/lib/offline/db";
import { PENDING_SAVE_EVENT } from "@/lib/offline/sync";

export const SYNC_COMPLETE_EVENT = "sajilo-sync-complete";

/**
 * Runs the offline → server sync queue.
 * - On mount (if online)
 * - When the browser goes back online
 * - Whenever a new pending log is saved (PENDING_SAVE_EVENT)
 *
 * Dispatches SYNC_COMPLETE_EVENT so status UI can refresh.
 */
export default function OfflineSync() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const run = async () => {
      const result = await syncOnce();
      if (result && result.synced > 0) {
        window.dispatchEvent(new Event(SYNC_COMPLETE_EVENT));
      }
    };

    run();

    const unsubscribeOnline = onOnlineStatusChange((online) => {
      if (online) run();
    });

    const handlePendingSave = () => run();
    window.addEventListener(PENDING_SAVE_EVENT, handlePendingSave);

    return () => {
      unsubscribeOnline();
      window.removeEventListener(PENDING_SAVE_EVENT, handlePendingSave);
    };
  }, []);

  return null;
}
