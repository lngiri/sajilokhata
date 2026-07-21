import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  CreditLogInsert,
  TransactionType,
  TransactionStatus,
  SyncStatus,
  CreditUnit,
} from "@/lib/types/database";

// IndexedDB Schema
interface QRHisabDB extends DBSchema {
  pendingLogs: {
    key: string;
    value: {
      id: string;
      merchantId: string;
      customerId: string | null;
      customerPhone: string;
      amount: number;
      quantity?: number;
      unit?: CreditUnit;
      description?: string;
      type: TransactionType;
      status: TransactionStatus;
      syncStatus: SyncStatus;
      ipAddress?: string;
      deviceInfo?: string;
      createdAt: string;
      items?: Array<{
        productId?: string;
        productName: string;
        quantity: number;
        unit: string;
        unitPrice: number;
        description?: string;
      }>;
    };
    indexes: {
      "by-merchant": string;
      "by-status": string;
    };
  };
  pendingAttachments: {
    key: string;
    value: {
      id: string;
      logId: string;
      merchantId: string;
      data: string;
      createdAt: string;
    };
    indexes: {
      "by-merchant": string;
      "by-log": string;
    };
  };
  offlineCustomers: {
    key: string;
    value: {
      id: string;
      name?: string;
      phone: string;
      homeLocationGps?: { lat: number; lng: number };
      createdAt: string;
    };
    indexes: {
      "by-phone": string;
    };
  };
  settings: {
    key: string;
    value: {
      key: string;
      value: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<QRHisabDB>> | null = null;

/**
 * Delete the entire IndexedDB database.
 * Called on sign-out / session-mismatch to prevent cross-user data leakage.
 */
export async function clearIndexedDB() {
  dbPromise = null; // Drop cached reference so next getDB() creates a fresh DB
  try {
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  } catch {
    // indexedDB.databases() may not be available in all browsers
    try {
      indexedDB.deleteDatabase("QR Hisab");
    } catch {
      // Ignore
    }
  }
}

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<QRHisabDB>("QR Hisab", 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          // Pending credit logs
          const logStore = db.createObjectStore("pendingLogs", {
            keyPath: "id",
          });
          logStore.createIndex("by-merchant", "merchantId");
          logStore.createIndex("by-status", "syncStatus");

          // Cached customers for offline lookup
          const customerStore = db.createObjectStore("offlineCustomers", {
            keyPath: "id",
          });
          customerStore.createIndex("by-phone", "phone");

          // App settings
          db.createObjectStore("settings", { keyPath: "key" });
        }
        if (oldVersion < 2) {
          // Pending photo attachments for offline capture
          const attachStore = db.createObjectStore("pendingAttachments", {
            keyPath: "id",
          });
          attachStore.createIndex("by-merchant", "merchantId");
          attachStore.createIndex("by-log", "logId");
        }
      },
    });
  }
  return dbPromise;
}

// ============================================================
// Pending Logs CRUD
// ============================================================

export async function savePendingLog(log: CreditLogInsert & { id: string; customerPhone?: string; items?: Array<{ productId?: string; productName: string; quantity: number; unit: string; unitPrice: number; description?: string }> }) {
  const db = await getDB();
  const entry = {
    id: log.id,
    merchantId: log.merchant_id,
    customerId: log.customer_id ?? null,
    customerPhone: log.customerPhone ?? "",
    amount: log.amount,
    quantity: log.quantity ?? undefined,
    unit: log.unit ?? undefined,
    description: log.description ?? undefined,
    type: log.type,
    status: log.status ?? "pending",
    syncStatus: "offline_pending" as SyncStatus,
    ipAddress: log.ip_address ?? undefined,
    deviceInfo: log.device_info ?? undefined,
    createdAt: log.created_at ?? new Date().toISOString(),
    items: log.items ?? undefined,
  };
  await db.put("pendingLogs", entry);
  return entry;
}

export async function getPendingLogs(): Promise<
  {
    id: string;
    merchantId: string;
    customerId: string | null;
    customerPhone: string;
    amount: number;
    quantity?: number;
    unit?: CreditUnit;
    description?: string;
    type: TransactionType;
    status: TransactionStatus;
    syncStatus: SyncStatus;
    ipAddress?: string;
    deviceInfo?: string;
    createdAt: string;
    items?: Array<{
      productId?: string;
      productName: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      description?: string;
    }>;
  }[]
> {
  const db = await getDB();
  return db.getAll("pendingLogs");
}

export async function getPendingLogsByMerchant(
  merchantId: string
): Promise<
  {
    id: string;
    merchantId: string;
    customerId: string | null;
    customerPhone: string;
    amount: number;
    quantity?: number;
    unit?: CreditUnit;
    description?: string;
    type: TransactionType;
    status: TransactionStatus;
    syncStatus: SyncStatus;
    ipAddress?: string;
    deviceInfo?: string;
    createdAt: string;
  }[]
> {
  const db = await getDB();
  return db.getAllFromIndex("pendingLogs", "by-merchant", merchantId);
}

export async function deletePendingLog(id: string) {
  const db = await getDB();
  await db.delete("pendingLogs", id);
}

export async function updatePendingLogSyncStatus(
  id: string,
  syncStatus: SyncStatus
) {
  const db = await getDB();
  const log = await db.get("pendingLogs", id);
  if (log) {
    log.syncStatus = syncStatus;
    await db.put("pendingLogs", log);
  }
}

/** Mark a pending log as currently being synced */
export async function markLogAsSyncing(id: string) {
  await updatePendingLogSyncStatus(id, "syncing");
}

/** Mark a pending log as failed (will be retried later) */
export async function markLogAsFailed(id: string) {
  await updatePendingLogSyncStatus(id, "failed");
}

/** Get count of pending logs by sync status */
export async function getPendingLogsCount(status?: SyncStatus): Promise<number> {
  const db = await getDB();
  if (status) {
    const all = await db.getAll("pendingLogs");
    return all.filter((l) => l.syncStatus === status).length;
  }
  const all = await db.getAll("pendingLogs");
  return all.length;
}

// ============================================================
// Pending Attachments (offline photo capture)
// ============================================================

export async function savePendingAttachment(attachment: {
  id: string;
  logId: string;
  merchantId: string;
  data: string;
}) {
  const db = await getDB();
  const entry = {
    ...attachment,
    createdAt: new Date().toISOString(),
  };
  await db.put("pendingAttachments", entry);
  return entry;
}

export async function getPendingAttachments(): Promise<{
  id: string;
  logId: string;
  merchantId: string;
  data: string;
  createdAt: string;
}[]> {
  const db = await getDB();
  return db.getAll("pendingAttachments");
}

export async function getPendingAttachmentsByMerchant(
  merchantId: string
): Promise<{
  id: string;
  logId: string;
  merchantId: string;
  data: string;
  createdAt: string;
}[]> {
  const db = await getDB();
  return db.getAllFromIndex("pendingAttachments", "by-merchant", merchantId);
}

export async function getPendingAttachmentByLogId(logId: string) {
  const db = await getDB();
  const all = await db.getAllFromIndex("pendingAttachments", "by-log", logId);
  return all[0] || null;
}

export async function deletePendingAttachment(id: string) {
  const db = await getDB();
  await db.delete("pendingAttachments", id);
}

// ============================================================
// Offline Customers
// ============================================================

export async function saveOfflineCustomer(customer: {
  id: string;
  name?: string;
  phone: string;
  homeLocationGps?: { lat: number; lng: number };
}) {
  const db = await getDB();
  const entry = {
    ...customer,
    createdAt: new Date().toISOString(),
  };
  await db.put("offlineCustomers", entry);
  return entry;
}

export async function getOfflineCustomerByPhone(phone: string) {
  const db = await getDB();
  return db.getFromIndex("offlineCustomers", "by-phone", phone);
}

export async function getAllOfflineCustomers() {
  const db = await getDB();
  return db.getAll("offlineCustomers");
}

// ============================================================
// Settings
// ============================================================

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDB();
  const setting = await db.get("settings", key);
  return setting?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  const db = await getDB();
  await db.put("settings", { key, value });
}

// ============================================================
// Sync Health Tracking
// ============================================================

const LAST_SYNC_KEY = "last_sync_timestamp";

/**
 * Record the current time as the last successful sync.
 */
export async function recordSyncComplete() {
  await setSetting(LAST_SYNC_KEY, Date.now().toString());
}

/**
 * Get the last sync timestamp, or null if never synced.
 */
export async function getLastSyncTime(): Promise<Date | null> {
  const val = await getSetting(LAST_SYNC_KEY);
  if (!val) return null;
  const ts = Number(val);
  return isNaN(ts) ? null : new Date(ts);
}

// ============================================================
// Network Status Detection
// ============================================================

export function isOnline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine;
}

export function onOnlineStatusChange(callback: (online: boolean) => void) {
  const handler = () => callback(navigator.onLine);
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  return () => {
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
  };
}
