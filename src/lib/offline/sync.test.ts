import { describe, it, expect, beforeEach, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  getPendingLogs: vi.fn(),
  getPendingAttachmentByLogId: vi.fn(),
  deletePendingLog: vi.fn(),
  deletePendingAttachment: vi.fn(),
  markLogAsSyncing: vi.fn(),
  markLogAsFailed: vi.fn(),
  recordSyncComplete: vi.fn(),
  isOnline: vi.fn(),
}));

const actionsMock = vi.hoisted(() => ({
  saveEntry: vi.fn(),
  uploadAttachment: vi.fn(),
  submitCustomerEntry: vi.fn(),
}));

vi.mock("@/lib/offline/db", () => dbMock);
vi.mock("@/app/actions/entry", () => ({ saveEntry: actionsMock.saveEntry }));
vi.mock("@/app/actions/merchant", () => ({ uploadAttachment: actionsMock.uploadAttachment }));
vi.mock("@/app/actions/customer", () => ({ submitCustomerEntry: actionsMock.submitCustomerEntry }));

import { flushPendingLogs, syncOnce } from "@/lib/offline/sync";
import type { PendingLog } from "@/lib/offline/types";

const merchantLog: PendingLog = {
  id: "p1",
  merchantId: "m1",
  customerId: null,
  customerPhone: "",
  amount: 500,
  type: "debit",
  status: "awaiting_confirmation",
  syncStatus: "offline_pending",
  createdAt: "2025-01-01T00:00:00Z",
  idempotencyKey: "k-merchant-1",
};

const customerLog: PendingLog = {
  id: "p2",
  merchantId: "m1",
  customerId: "",
  customerPhone: "9841234567",
  amount: 200,
  type: "credit",
  status: "awaiting_confirmation",
  syncStatus: "offline_pending",
  createdAt: "2025-01-01T00:00:00Z",
  idempotencyKey: "k-customer-1",
};

describe("flushPendingLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.isOnline.mockReturnValue(true);
    dbMock.getPendingAttachmentByLogId.mockResolvedValue(null);
  });

  it("returns empty result when no pending logs", async () => {
    dbMock.getPendingLogs.mockResolvedValue([]);
    await expect(flushPendingLogs()).resolves.toEqual({ synced: 0, failed: 0, total: 0 });
    expect(actionsMock.saveEntry).not.toHaveBeenCalled();
  });

  it("syncs a merchant log via saveEntry and deletes it", async () => {
    dbMock.getPendingLogs.mockResolvedValue([merchantLog]);
    actionsMock.saveEntry.mockResolvedValue({ success: true, entry: { id: "x", status: "approved" } });

    const result = await flushPendingLogs();

    expect(result).toEqual({ synced: 1, failed: 0, total: 1 });
    expect(actionsMock.saveEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: "m1",
        amount: 500,
        type: "debit",
        idempotency_key: "k-merchant-1",
      })
    );
    expect(dbMock.markLogAsSyncing).toHaveBeenCalledWith("p1");
    expect(dbMock.deletePendingLog).toHaveBeenCalledWith("p1");
    expect(dbMock.deletePendingAttachment).toHaveBeenCalledWith("p1");
    expect(dbMock.recordSyncComplete).toHaveBeenCalled();
  });

  it("re-uploads an offline attachment and passes the URL", async () => {
    dbMock.getPendingLogs.mockResolvedValue([merchantLog]);
    dbMock.getPendingAttachmentByLogId.mockResolvedValue({
      id: "a1",
      logId: "p1",
      merchantId: "m1",
      data: "aGVsbG8=",
      createdAt: "2025-01-01T00:00:00Z",
    });
    actionsMock.uploadAttachment.mockResolvedValue("https://cdn/photo.webp");
    actionsMock.saveEntry.mockResolvedValue({ success: true, entry: { id: "x", status: "approved" } });

    await flushPendingLogs();

    expect(actionsMock.uploadAttachment).toHaveBeenCalledWith("m1", "p1", expect.any(Blob));
    expect(actionsMock.saveEntry).toHaveBeenCalledWith(
      expect.objectContaining({ attachment_url: "https://cdn/photo.webp" })
    );
  });

  it("syncs a customer-origin log via submitCustomerEntry", async () => {
    dbMock.getPendingLogs.mockResolvedValue([customerLog]);
    actionsMock.submitCustomerEntry.mockResolvedValue({ success: true, entry: { id: "y", status: "awaiting_confirmation" } });

    const result = await flushPendingLogs();

    expect(result).toEqual({ synced: 1, failed: 0, total: 1 });
    expect(actionsMock.submitCustomerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: "m1",
        phone: "9841234567",
        amount: 200,
        type: "credit",
        idempotency_key: "k-customer-1",
      })
    );
    expect(actionsMock.saveEntry).not.toHaveBeenCalled();
    expect(dbMock.deletePendingLog).toHaveBeenCalledWith("p2");
  });

  it("marks a log failed and keeps it when the server rejects", async () => {
    dbMock.getPendingLogs.mockResolvedValue([merchantLog]);
    actionsMock.saveEntry.mockResolvedValue({ success: false, error: "Not authorized" });

    const result = await flushPendingLogs();

    expect(result).toEqual({ synced: 0, failed: 1, total: 1 });
    expect(dbMock.markLogAsFailed).toHaveBeenCalledWith("p1");
    expect(dbMock.deletePendingLog).not.toHaveBeenCalled();
    expect(dbMock.recordSyncComplete).not.toHaveBeenCalled();
  });

  it("stops early when the connection drops mid-flush", async () => {
    dbMock.getPendingLogs.mockResolvedValue([merchantLog, customerLog]);
    dbMock.isOnline
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    actionsMock.saveEntry.mockResolvedValue({ success: true, entry: { id: "x", status: "approved" } });

    await flushPendingLogs();

    expect(actionsMock.saveEntry).toHaveBeenCalledTimes(1);
    expect(actionsMock.submitCustomerEntry).not.toHaveBeenCalled();
  });
});

describe("syncOnce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when offline", async () => {
    dbMock.isOnline.mockReturnValue(false);
    await expect(syncOnce()).resolves.toBeNull();
    expect(dbMock.getPendingLogs).not.toHaveBeenCalled();
  });

  it("runs the flush when online", async () => {
    dbMock.isOnline.mockReturnValue(true);
    dbMock.getPendingLogs.mockResolvedValue([]);
    await expect(syncOnce()).resolves.toEqual({ synced: 0, failed: 0, total: 0 });
  });

  it("prevents concurrent runs", async () => {
    dbMock.isOnline.mockReturnValue(true);
    dbMock.getPendingLogs.mockResolvedValue([]);
    const first = syncOnce();
    await expect(syncOnce()).resolves.toBeNull();
    await first;
  });
});
