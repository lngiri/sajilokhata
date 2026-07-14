"use client";

import { useState } from "react";

interface PendingEntry {
  id: string;
  customerName: string;
  amount: number;
  description: string | null;
}

interface PendingApprovalModalProps {
  show: boolean;
  onClose: () => void;
  onViewHistory?: () => void;
  /** Customer mode — info about their submission */
  mode: "customer";
  amount?: number;
  shopName?: string;
}

interface MerchantApprovalModalProps {
  show: boolean;
  onClose: () => void;
  mode: "merchant";
  entries: PendingEntry[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

type Props = PendingApprovalModalProps | MerchantApprovalModalProps;

export default function PendingApprovalModal(props: Props) {
  if (!props.show) return null;

  if (props.mode === "customer") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in p-4">
        <div className="w-full max-w-sm bg-white rounded-3xl p-6 animate-slide-up shadow-2xl text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
            <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">Pending Approval</h2>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            Your credit request of{" "}
            <span className="font-semibold text-[var(--color-text)]">
              Rs. {Number(props.amount || 0).toLocaleString()}
            </span>
            {props.shopName ? (
              <> has been sent to <span className="font-semibold text-[var(--color-text)]">{props.shopName}</span>.</>
            ) : (
              <> has been sent.</>
            )}
            <br />
            The shopkeeper will review and approve it shortly.
          </p>

          <div className="mt-6 space-y-2">
            {props.onViewHistory && (
              <button
                onClick={props.onViewHistory}
                className="w-full py-3 bg-gray-100 text-[var(--color-text)] rounded-xl font-medium active:scale-[0.98] transition-transform"
              >
                Track in History
              </button>
            )}
            <button
              onClick={props.onClose}
              className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Merchant mode
  const merchantProps = props as MerchantApprovalModalProps;
  const [savingId, setSavingId] = useState<string | null>(null);
  const [entryList, setEntryList] = useState(merchantProps.entries);

  const handleApprove = async (id: string) => {
    setSavingId(id);
    try {
      await merchantProps.onApprove(id);
      setEntryList((prev) => prev.filter((e) => e.id !== id));
    } finally {
      setSavingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setSavingId(id);
    try {
      await merchantProps.onReject(id);
      setEntryList((prev) => prev.filter((e) => e.id !== id));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-t-3xl animate-slide-up max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="font-bold text-lg text-[var(--color-text)]">
              Pending Approval
            </h2>
          </div>
          <button onClick={merchantProps.onClose} className="p-1">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {entryList.length === 0 ? (
            <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">
              All entries have been reviewed.
            </div>
          ) : (
            entryList.map((entry) => (
              <div
                key={entry.id}
                className="bg-gray-50 rounded-xl p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm text-[var(--color-text)]">
                    {entry.customerName}
                  </p>
                  <p className="font-bold text-sm text-[var(--color-danger)]">
                    Rs. {entry.amount.toLocaleString()}
                  </p>
                </div>
                {entry.description && (
                  <p className="text-xs text-[var(--color-text-muted)] truncate">
                    {entry.description}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleReject(entry.id)}
                    disabled={savingId === entry.id}
                    className="flex-1 py-2 bg-gray-200 text-gray-600 rounded-lg text-xs font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(entry.id)}
                    disabled={savingId === entry.id}
                    className="flex-1 py-2 bg-[var(--color-primary)] text-white rounded-lg text-xs font-medium active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {savingId === entry.id ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Approve"
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-50">
          <button
            onClick={merchantProps.onClose}
            className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
