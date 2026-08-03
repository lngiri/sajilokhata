import type {
  TransactionType,
  TransactionStatus,
  SyncStatus,
  CreditUnit,
} from "@/lib/types/database";

/** Shape of a row in the IndexedDB `pendingLogs` store. */
export interface PendingLog {
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
  idempotencyKey?: string;
  items?: Array<{
    productId?: string;
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    description?: string;
  }>;
}
