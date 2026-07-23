"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { getCurrentMerchantId } from "@/lib/auth";
import { getMerchantCustomerDetail, updateCustomerCreditLimit, updateCustomerTrustStatus, getAuditLogsForCreditLog, getMerchantProfile } from "@/app/actions/merchant";
import { getMerchantSmsBalance } from "@/app/actions/sms-billing";
import TransactionIcon from "@/components/TransactionIcon";
import SmsReminderModal from "@/components/SmsReminderModal";

const STATUS_BADGE: Record<string, string> = {
  approved: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  pending: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  rejected: "bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-slate-400",
  disputed: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
  unverified: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  edit_requested: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300",
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
  disputed: "Disputed",
  unverified: "Unverified",
  edit_requested: "Edit Req.",
};

interface Transaction {
  id: string;
  amount: number;
  type: "debit" | "credit" | "cash";
  status: string;
  description: string | null;
  created_at: string;
  attachment_url: string | null;
  initiated_by: string | null;
  ip_address: string | null;
  device_info: string | null;
}

interface CustomerDetail {
  id: string;
  name: string | null;
  phone: string;
  credit_limit: number;
  current_balance: number;
  total_debit_amount: number;
  total_credit_amount: number;
  transactions: Transaction[];
  trust_status: string;
  trust_notes: string | null;
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;
  const customerId = useParams<{ id: string }>().id;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreditLimitModal, setShowCreditLimitModal] = useState(false);
  const [newLimit, setNewLimit] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagStatus, setFlagStatus] = useState<"warning" | "defaulter">("warning");
  const [flagNotes, setFlagNotes] = useState("");
  const [flagging, setFlagging] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<Array<{id: string; action_type: string; actor_type: string; actor_id: string; old_data: unknown; new_data: unknown; inserted_at: string}>>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState("");
  const [merchantIdState, setMerchantIdState] = useState<string | null>(null);
  const [smsBalance, setSmsBalance] = useState<number>(0);
  const txSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCreditLimitModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowCreditLimitModal(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showCreditLimitModal]);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomer() {
      setLoading(true);
      try {
        const merchantId = await getCurrentMerchantId();
        if (!merchantId || !customerId || cancelled) {
          setLoading(false);
          return;
        }

        const detail = await getMerchantCustomerDetail(merchantId, customerId);
        if (cancelled) return;

        if (!detail) {
          setLoading(false);
          return;
        }

        setMerchantIdState(merchantId);
        setCustomer(detail as CustomerDetail);

        getMerchantProfile(merchantId, "name").then((p: any) => {
          if (p?.name) setMerchantName(p.name);
        }).catch(() => {});
        getMerchantSmsBalance(merchantId).then(setSmsBalance).catch(() => {});
      } catch {
        if (!cancelled) addToastRef.current("Failed to load customer details.", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCustomer();
    return () => { cancelled = true; };
  }, [customerId]);

  const handleSaveLimit = async () => {
    if (!newLimit || Number(newLimit) < 0) {
      addToast("Please enter a valid credit limit.", "error");
      return;
    }
    setSavingLimit(true);
    try {
      const merchantId = await getCurrentMerchantId();
      if (merchantId) {
        await updateCustomerCreditLimit(merchantId, customerId, Number(newLimit));
        setCustomer((prev) =>
          prev ? { ...prev, credit_limit: Number(newLimit) } : prev
        );
        addToast("Credit limit updated!", "success");
        setShowCreditLimitModal(false);
      }
    } catch {
      addToast("Failed to update credit limit.", "error");
    } finally {
      setSavingLimit(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!customer) return null;

  const balancePercent = customer.credit_limit > 0
    ? (customer.current_balance / customer.credit_limit) * 100
    : 0;

  return (
    <div className="pb-20 min-h-dvh bg-[var(--color-bg)]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="flex items-center px-4 py-3">
          <button onClick={() => router.back()} aria-label="Back" className="mr-3 p-1 active:scale-95 transition-transform">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-[var(--color-text)]">Customer Detail</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Customer Info Card — clickable, scrolls to transaction history */}
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            // Don't scroll if a nested button was clicked
            if ((e.target as HTMLElement).closest("button")) return;
            txSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              txSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="w-full text-left bg-[var(--color-surface)] rounded-2xl p-5 shadow-sm border border-[var(--color-border)] active:scale-[0.99] transition-transform cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                <span className="text-xl font-bold text-[var(--color-primary)]">
                  {(customer.name || customer.phone).charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="font-bold text-lg text-[var(--color-text)]">{customer.name || "Unknown"}</h2>
                <p className="text-sm text-[var(--color-text-muted)]">{customer.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {customer.trust_status === "good" ? (
                <button
                  onClick={() => { setFlagStatus("warning"); setFlagNotes(""); setShowFlagModal(true); }}
                  className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-medium active:scale-[0.98]"
                >
                  Flag
                </button>
              ) : (
                <button
                  onClick={async () => {
                    const merchantId = await getCurrentMerchantId();
                    if (!merchantId) return;
                    const r = await updateCustomerTrustStatus(merchantId, customer.id, "clear");
                    if (r.success) {
                      setCustomer((prev) => prev ? { ...prev, trust_status: "good", trust_notes: null } : prev);
                      addToast("Trust flag cleared", "success");
                    } else {
                      addToast(r.error || "Failed to clear", "error");
                    }
                  }}
                  className="px-3 py-1.5 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-lg text-xs font-medium active:scale-[0.98]"
                >
                  Clear Flag
                </button>
              )}
              {customer.current_balance > 0 && (
                <button
                  onClick={() => setShowReminderModal(true)}
                  className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium active:scale-[0.98]"
                >
                  Remind
                </button>
              )}
              <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </div>
        </div>

        {/* Trust Warning Banner (only if flagged — no identity leak) */}
        {customer.trust_status !== "good" && (
          <div className={`rounded-2xl p-4 shadow-sm border ${
            customer.trust_status === "defaulter"
              ? "bg-red-100 dark:bg-red-900/40 border-red-200 dark:border-red-900/50"
              : "bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-900/50"
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                customer.trust_status === "defaulter" ? "bg-red-100 dark:bg-red-900/40" : "bg-amber-100 dark:bg-amber-900/40"
              }`}>
                <svg className={`w-4 h-4 ${customer.trust_status === "defaulter" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${customer.trust_status === "defaulter" ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300"}`}>
                  Trust Warning
                </p>
                <p className={`text-xs mt-0.5 ${customer.trust_status === "defaulter" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                  This customer has been flagged as{" "}
                  <span className="font-medium capitalize">{customer.trust_status}</span>
                </p>
                {customer.trust_notes && (
                  <p className={`text-xs mt-1 italic ${customer.trust_status === "defaulter" ? "text-red-500 dark:text-red-400" : "text-amber-500 dark:text-amber-400"}`}>
                    "{customer.trust_notes}"
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Balance Overview */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-5 shadow-sm border border-[var(--color-border)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Current Balance</p>
              <p className="text-2xl font-bold text-[var(--color-danger)]">
                Rs. {customer.current_balance.toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => { setNewLimit(String(customer.credit_limit)); setShowCreditLimitModal(true); }}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-medium text-[var(--color-text)] active:scale-[0.98]"
            >
              Edit Limit
            </button>
          </div>

          {/* Balance Bar */}
          <div>
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
              <span>Credit Used</span>
              <span>{balancePercent.toFixed(0)}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  balancePercent > 80 ? "bg-[var(--color-danger)]" : balancePercent > 50 ? "bg-[var(--color-accent)]" : "bg-[var(--color-primary)]"
                }`}
                style={{ width: `${Math.min(100, balancePercent)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
              <span>Rs. 0</span>
              <span>Rs. {customer.credit_limit.toLocaleString()}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 text-center">
              <p className="text-xs text-[var(--color-text-muted)]">Total Credit Taken</p>
              <p className="font-bold text-[var(--color-danger)]">Rs. {customer.total_debit_amount.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 text-center">
              <p className="text-xs text-[var(--color-text-muted)]">Total Paid</p>
              <p className="font-bold text-[var(--color-primary)]">Rs. {customer.total_credit_amount.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div ref={txSectionRef}>
          <h3 className="font-semibold text-[var(--color-text)] mb-3">Recent Transactions</h3>
          <div className="space-y-2">
            {customer.transactions.length === 0 ? (
              <div className="text-center py-8 text-[var(--color-text-muted)]">
                <p className="text-sm">No transactions yet</p>
              </div>
            ) : (
              customer.transactions.map((tx) => (
                <div
                  key={tx.id}
                  onClick={async () => {
                    setAuditLogs([]);
                    setAuditLoading(true);
                    setShowAuditModal(true);
                    try {
                      const logs = await getAuditLogsForCreditLog(tx.id);
                      setAuditLogs(logs);
                    } catch {} finally {
                      setAuditLoading(false);
                    }
                  }}
                  className={`bg-[var(--color-surface)] rounded-xl p-4 shadow-sm border border-[var(--color-border)] flex items-center gap-3 active:scale-[0.99] transition-transform cursor-pointer ${tx.status === "rejected" ? "opacity-60" : ""}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === "debit" ? "bg-red-100 dark:bg-red-900/40" : tx.type === "cash" ? "bg-blue-100 dark:bg-blue-900/40" : "bg-green-100 dark:bg-green-900/40"}`}>
                    <TransactionIcon type={tx.type} size={16} className={tx.type === "debit" ? "text-red-600 dark:text-red-400" : tx.type === "cash" ? "text-blue-600 dark:text-blue-400" : "text-green-600 dark:text-green-400"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium text-sm truncate ${tx.status === "rejected" ? "text-slate-500 line-through" : "text-[var(--color-text)]"}`}>
                        {tx.type === "cash" ? `Cash Sale${tx.description ? ` - ${tx.description}` : ""}` : (tx.description || "No description")}
                      </p>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${STATUS_BADGE[tx.status] || "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}>
                        {STATUS_LABELS[tx.status] || tx.status}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {new Date(tx.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Kathmandu" })}
                    </p>
                    {(tx.ip_address || tx.device_info) && (
                      <p className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[200px]">
                        {[tx.device_info, tx.ip_address].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {tx.attachment_url && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setPreviewImage(tx.attachment_url); }}
                         className="mt-1 inline-flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 font-medium active:opacity-70"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                        </svg>
                        View Voucher
                      </button>
                    )}
                  </div>
                  <p className={`font-bold text-sm ${tx.status === "rejected" ? "text-slate-400 line-through" : tx.type === "debit" ? "text-[var(--color-danger)]" : tx.type === "cash" ? "text-blue-600 dark:text-blue-400" : "text-[var(--color-primary)]"}`}>
                    {tx.type === "cash" ? "" : (tx.type === "debit" ? "+" : "-")}Rs. {tx.amount.toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Credit Limit Modal */}
      {showCreditLimitModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
          <div className="w-full max-w-md bg-[var(--color-surface)] rounded-t-3xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-[var(--color-text)]">Update Credit Limit</h3>
              <button onClick={() => setShowCreditLimitModal(false)} className="p-1">
                <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-[var(--color-text)]">Credit Limit</label>
              <input
                type="number"
                min="0"
                step="1"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                className="w-full mt-1 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl text-lg font-bold border-0 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
              />
            </div>
            <button
              onClick={handleSaveLimit}
              disabled={savingLimit}
              className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savingLimit ? (
                <div className="w-5 h-5 border-2 border-[var(--color-bg)] border-t-transparent rounded-full animate-spin" />
              ) : (
                "Save Limit"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Flag Customer Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
          <div className="w-full max-w-md bg-[var(--color-surface)] rounded-t-3xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-[var(--color-text)]">Flag Customer</h3>
              <button onClick={() => setShowFlagModal(false)} className="p-1">
                <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm font-medium text-[var(--color-text)]">Status</label>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setFlagStatus("warning")}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${flagStatus === "warning" ? "bg-amber-500 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-800 text-[var(--color-text-muted)]"}`}
                  >
                    Warning
                  </button>
                  <button
                    onClick={() => setFlagStatus("defaulter")}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${flagStatus === "defaulter" ? "bg-red-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-800 text-[var(--color-text-muted)]"}`}
                  >
                    Defaulter
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--color-text)]">Notes (optional)</label>
                <textarea
                  value={flagNotes}
                  onChange={(e) => setFlagNotes(e.target.value)}
                  rows={2}
                  maxLength={200}
                  placeholder="e.g. Repeated late payments"
                  className="w-full mt-1 px-3 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all text-sm resize-none dark:text-white"
                />
              </div>
            </div>
            <button
              onClick={async () => {
                const merchantId = await getCurrentMerchantId();
                if (!merchantId) return;
                setFlagging(true);
                try {
                  const r = await updateCustomerTrustStatus(merchantId, customer.id, "flag", { status: flagStatus, notes: flagNotes || undefined });
                  if (r.success) {
                    setCustomer((prev) => prev ? { ...prev, trust_status: flagStatus, trust_notes: flagNotes || null } : prev);
                    addToast("Customer flagged", "success");
                    setShowFlagModal(false);
                  } else {
                    addToast(r.error || "Failed to flag", "error");
                  }
                } catch {
                  addToast("Failed to flag customer", "error");
                } finally {
                  setFlagging(false);
                }
              }}
              disabled={flagging}
              className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {flagging ? (
                <div className="w-5 h-5 border-2 border-[var(--color-bg)] border-t-transparent rounded-full animate-spin" />
              ) : (
                `Flag as ${flagStatus === "warning" ? "Warning" : "Defaulter"}`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Audit Trail Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in" onClick={() => setShowAuditModal(false)}>
          <div className="w-full max-w-md bg-[var(--color-surface)] rounded-t-3xl p-6 animate-slide-up max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-[var(--color-text)]">Audit Trail</h3>
              <button onClick={() => setShowAuditModal(false)} className="p-1">
                <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {auditLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="text-center text-sm text-[var(--color-text-muted)] py-8">No audit records found for this transaction.</p>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${
                      log.action_type === "approved" ? "bg-green-500" :
                      log.action_type === "rejected" ? "bg-red-500" :
                      log.action_type === "disputed" ? "bg-red-400" :
                      log.action_type === "edit_requested" ? "bg-indigo-500" :
                      log.action_type === "edit_accepted" ? "bg-green-400" :
                      log.action_type === "edit_rejected" ? "bg-orange-500" :
                      "bg-gray-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text)] capitalize">{log.action_type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        by {log.actor_type || "system"}
                        {" · "}
                        {new Date(log.inserted_at).toLocaleString("en-US", {
                          month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                          timeZone: "Asia/Kathmandu",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {merchantIdState && (
        <SmsReminderModal
          open={showReminderModal}
          onClose={() => setShowReminderModal(false)}
          merchantId={merchantIdState}
          merchantName={merchantName || "Shop"}
          customerId={customer.id}
          customerName={customer.name}
          customerPhone={customer.phone}
          balance={customer.current_balance}
          smsBalance={smsBalance}
        />
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white z-10"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={previewImage}
            alt="Voucher screenshot"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}


    </div>
  );
}
