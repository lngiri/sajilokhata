import {
  getPendingLogs,
  getPendingAttachmentByLogId,
  deletePendingLog,
  deletePendingAttachment,
  markLogAsSyncing,
  markLogAsFailed,
  recordSyncComplete,
  isOnline,
} from "@/lib/offline/db";
import { saveEntry } from "@/app/actions/entry";
import { uploadAttachment } from "@/app/actions/merchant";
import { submitCustomerEntry } from "@/app/actions/customer";
import type { PendingLog } from "@/lib/offline/types";

export const PENDING_SAVE_EVENT = "sajilo-pending-save";

let flushing = false;

/** Notify the app that a pending (offline) save was queued so sync can run on reconnect. */
export function notifyPendingSave() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PENDING_SAVE_EVENT));
}

function base64ToBlob(data: string, mime = "image/webp"): Blob {
  const base64 = data.includes(",") ? data.split(",")[1] : data;
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function syncMerchantLog(log: PendingLog): Promise<boolean> {
  let attachmentUrl: string | null = null;
  const attachment = await getPendingAttachmentByLogId(log.id);
  if (attachment) {
    try {
      attachmentUrl = await uploadAttachment(log.merchantId, log.id, base64ToBlob(attachment.data));
    } catch (err) {
      console.error("[Sync] Offline attachment upload failed:", err);
      return false;
    }
  }

  const result = await saveEntry({
    merchant_id: log.merchantId,
    customer_id: log.customerId ?? undefined,
    customer_phone: log.customerPhone || undefined,
    amount: log.amount,
    type: log.type,
    description: log.description ?? null,
    quantity: log.quantity ?? null,
    unit: log.unit ?? null,
    attachment_url: attachmentUrl,
    idempotency_key: log.idempotencyKey,
    items: log.items?.length
      ? log.items.map((item) => ({
          product_id: item.productId ?? null,
          product_name: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unitPrice,
          description: item.description,
        }))
      : undefined,
  });

  if (!result.success) {
    console.error("[Sync] Merchant offline log failed:", result.error, result.fullError);
    return false;
  }
  return true;
}

async function syncCustomerLog(log: PendingLog): Promise<boolean> {
  const result = await submitCustomerEntry({
    merchant_id: log.merchantId,
    phone: log.customerPhone,
    amount: log.amount,
    description: log.description ?? null,
    type: log.type as "debit" | "credit",
    idempotency_key: log.idempotencyKey,
  });

  if (!result.success) {
    console.error("[Sync] Customer offline log failed:", result.error);
    return false;
  }
  return true;
}

/**
 * Push every pending offline log to the server. Merchant-origin logs go through
 * saveEntry (with attachment re-upload); customer-origin logs (customerId === "")
 * go through submitCustomerEntry. Both use the stored idempotency key, so a log
 * already recorded via the reverse-QR handoff is deduped instead of duplicated.
 *
 * @returns { synced, failed, total }
 */
export async function flushPendingLogs(): Promise<{
  synced: number;
  failed: number;
  total: number;
}> {
  const logs = await getPendingLogs();
  if (logs.length === 0) return { synced: 0, failed: 0, total: 0 };

  let synced = 0;
  let failed = 0;

  for (const log of logs) {
    if (!isOnline()) break;

    try {
      await markLogAsSyncing(log.id);
      // Customer-origin offline logs are saved with customer_id "" (scan page);
      // merchant-origin logs have null or a real UUID. Never trust amount/type.
      const isCustomerOrigin = log.customerId === "";
      const ok = isCustomerOrigin ? await syncCustomerLog(log) : await syncMerchantLog(log);

      if (ok) {
        await deletePendingLog(log.id);
        await deletePendingAttachment(log.id);
        synced++;
      } else {
        await markLogAsFailed(log.id);
        failed++;
      }
    } catch (err) {
      console.error("[Sync] Pending log processing error:", err);
      try {
        await markLogAsFailed(log.id);
      } catch {
        // ignore
      }
      failed++;
    }
  }

  if (synced > 0) await recordSyncComplete();
  return { synced, failed, total: logs.length };
}

/** Run a sync once — guarded against concurrent runs and offline state. */
export async function syncOnce(): Promise<{ synced: number; failed: number; total: number } | null> {
  if (flushing) return null;
  if (!isOnline()) return null;
  flushing = true;
  try {
    return await flushPendingLogs();
  } finally {
    flushing = false;
  }
}
