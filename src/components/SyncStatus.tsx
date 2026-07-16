"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/Toast";
import {
  isOnline,
  onOnlineStatusChange,
  getPendingLogs,
  getDeliveryLogs,
  syncPendingLogs,
  syncDeliveryLogs,
  recordSyncComplete,
  getLastSyncTime,
  getPendingAttachments,
  deletePendingAttachment,
} from "@/lib/offline/db";
import { createCreditLog, findOrCreateCustomer, linkCustomerToMerchant, uploadAttachment } from "@/lib/actions";
import { updateEntryAttachment } from "@/app/actions/entry";

/** Format a timestamp as a relative string (e.g. "2 min ago") */
function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function resolveOfflineCustomer(phone: string, merchantId: string) {
  const customer = await findOrCreateCustomer(phone);
  await linkCustomerToMerchant(merchantId, customer.id);
  return customer;
}

export default function SyncStatus() {
  const { addToast } = useToast();
  const [online, setOnline] = useState(true);
  const [pendingCreditCount, setPendingCreditCount] = useState(0);
  const [pendingDeliveryCount, setPendingDeliveryCount] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pendingAttachmentCount, setPendingAttachmentCount] = useState(0);

  const totalPending = pendingCreditCount + pendingDeliveryCount + pendingAttachmentCount;

  const updateCounts = useCallback(async () => {
    const [creditLogs, deliveryLogs, lastSyncTime, attachments] = await Promise.all([
      getPendingLogs(),
      getDeliveryLogs(),
      getLastSyncTime(),
      getPendingAttachments(),
    ]);
    setPendingCreditCount(creditLogs.length);
    setPendingDeliveryCount(deliveryLogs.length);
    setPendingAttachmentCount(attachments.length);
    setLastSync(lastSyncTime);
  }, []);

  // Initial load + periodic refresh
  useEffect(() => {
    setOnline(isOnline());
    updateCounts();
    const interval = setInterval(updateCounts, 5_000);

    const unsubscribe = onOnlineStatusChange(async (status) => {
      setOnline(status);
      if (status) {
        await updateCounts();
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [updateCounts]);

  const handleSyncNow = async () => {
    if (syncing || !online) return;
    setSyncing(true);

    try {
      // Sync credit logs first, then delivery logs
      const creditResult = await syncPendingLogs(createCreditLog, resolveOfflineCustomer);
      const deliveryResult = await syncDeliveryLogs(createCreditLog);
      let attachmentSynced = 0;
      let attachmentFailed = 0;

      // Sync pending photo attachments
      const pendingAttachments = await getPendingAttachments();
      for (const att of pendingAttachments) {
        try {
          const blob = await (await fetch(att.data)).blob();
          const url = await uploadAttachment(att.merchantId, att.logId, blob);
          await updateEntryAttachment(att.logId, url);
          await deletePendingAttachment(att.id);
          attachmentSynced++;
        } catch {
          attachmentFailed++;
        }
      }

      const total = creditResult.synced + deliveryResult.synced + attachmentSynced;
      const failed = creditResult.failed + deliveryResult.failed + attachmentFailed;

      await recordSyncComplete();
      await updateCounts();

      if (total > 0) {
        addToast(`Synced ${total} item${total !== 1 ? "s" : ""}!`, "success");
      }
      if (failed > 0) {
        addToast(`Sync failed for ${failed} item${failed !== 1 ? "s" : ""}`, "error");
      }
    } catch {
      addToast("Sync failed. Will retry automatically.", "error");
    } finally {
      setSyncing(false);
    }
  };

  // Auto-sync when coming online — use the `status` param directly instead of
  // relying on component state (which may not have updated yet when callback fires)
  useEffect(() => {
    const run = async () => {
      if (syncing || !isOnline() || totalPending === 0) return;
      setSyncing(true);
      try {
        const creditResult = await syncPendingLogs(createCreditLog, resolveOfflineCustomer);
        const deliveryResult = await syncDeliveryLogs(createCreditLog);
        let attachmentSynced = 0;
        const pendingAttachments = await getPendingAttachments();
        for (const att of pendingAttachments) {
          try {
            const blob = await (await fetch(att.data)).blob();
            const url = await uploadAttachment(att.merchantId, att.logId, blob);
            await updateEntryAttachment(att.logId, url);
            await deletePendingAttachment(att.id);
            attachmentSynced++;
          } catch {
            // skip
          }
        }
        const total = creditResult.synced + deliveryResult.synced + attachmentSynced;
        await recordSyncComplete();
        await updateCounts();
        if (total > 0) {
          addToast(`Auto-synced ${total} item${total !== 1 ? "s" : ""}!`, "success");
        }
      } catch {
        // Silent — retry on interval
      } finally {
        setSyncing(false);
      }
    };

    const unsubscribe = onOnlineStatusChange(async (status) => {
      if (status) {
        await run();
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPending]);

  // Compact badge (shown when not expanded)
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center justify-center w-6 h-6 rounded-full border transition-colors active:scale-95"
        style={{
          backgroundColor: totalPending > 0 ? "rgb(255 251 235)" : online ? "rgb(240 253 244)" : "rgb(254 242 242)",
          borderColor: totalPending > 0 ? "rgb(253 230 138)" : online ? "rgb(187 247 208)" : "rgb(254 202 202)",
        }}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            syncing
              ? "bg-blue-500 animate-pulse"
              : online
                ? totalPending > 0
                  ? "bg-amber-500"
                  : "bg-green-500"
                : "bg-red-500 animate-pulse"
          }`}
        />
      </button>
    );
  }

  // Expanded detail card
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm mx-auto p-5 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[var(--color-text)]">Sync Status</h3>
          <button
            onClick={() => setExpanded(false)}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:scale-90 transition-transform"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {/* Network status */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  online ? "bg-green-500" : "bg-red-500 animate-pulse"
                }`}
              />
              <span className="text-sm font-medium text-[var(--color-text)]">
                {online ? "Online" : "Offline"}
              </span>
            </div>
            <span className="text-xs text-[var(--color-text-muted)]">
              {online ? "Connected" : "No connection"}
            </span>
          </div>

          {/* Pending credit logs */}
          <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
            <div className="flex items-center gap-2.5">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
              <span className="text-sm font-medium text-amber-800">Credit Logs</span>
            </div>
            <span className="text-sm font-bold text-amber-700">
              {pendingCreditCount} pending
            </span>
          </div>

          {/* Pending delivery logs */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
            <div className="flex items-center gap-2.5">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h17.25m-17.25 0V5.625A2.25 2.25 0 015.625 3.375h2.25a.75.75 0 00.75-.75V3.375m4.5 0a.75.75 0 00.75.75h2.25A2.25 2.25 0 0117.25 5.625v5.625m0 0H3.375" />
              </svg>
              <span className="text-sm font-medium text-blue-800">Deliveries</span>
            </div>
            <span className="text-sm font-bold text-blue-700">
              {pendingDeliveryCount} pending
            </span>
          </div>

          {/* Last sync time */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2.5">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-[var(--color-text)]">Last Sync</span>
            </div>
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              {lastSync ? timeAgo(lastSync) : "Never"}
            </span>
          </div>

          {/* Sync now button */}
          <button
            onClick={handleSyncNow}
            disabled={syncing || !online || totalPending === 0}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
            style={{
              backgroundColor: online ? "rgb(22 163 74)" : "rgb(107 114 128)",
              color: "white",
            }}
          >
            {syncing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Syncing...
              </>
            ) : !online ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m-2.829-2.829a5 5 0 000-7.07m-4.243 2.121a1.5 1.5 0 012.122 0m2.121 2.121a1.5 1.5 0 010 2.122m-2.121-2.121a1.5 1.5 0 00-2.122 0M3.375 19.5h17.25" />
                </svg>
                Offline — Auto-sync when reconnected
              </>
            ) : totalPending === 0 ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                All Synced
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
                Sync {totalPending} Pending Item{totalPending !== 1 ? "s" : ""}
              </>
            )}
          </button>

          {/* Close hint */}
          <p className="text-center text-[10px] text-[var(--color-text-muted)]">
            Tap outside or press Close to dismiss
          </p>
        </div>

        <button
          onClick={() => setExpanded(false)}
          className="w-full mt-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm active:scale-[0.98] transition-transform"
        >
          Close
        </button>
      </div>
    </div>
  );
}
