"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { getCurrentMerchantId } from "@/lib/auth";
import { getMerchantCreditLogs, updateCustomerCreditLimit } from "@/lib/actions";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  status: string;
  description: string | null;
  created_at: string;
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

  useEffect(() => {
    if (!showCreditLimitModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowCreditLimitModal(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showCreditLimitModal]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function loadCustomer() {
      setLoading(true);
      try {
        const merchantId = await getCurrentMerchantId();
        if (!merchantId || !customerId || cancelled) {
          setLoading(false);
          return;
        }

        const { data: mc } = await supabase
          .from("merchant_customers")
          .select("*, customers(id, name, phone)")
          .eq("merchant_id", merchantId)
          .eq("customer_id", customerId)
          .single();

        if (!mc || cancelled) {
          setLoading(false);
          return;
        }

        const logs = await getMerchantCreditLogs(merchantId, {
          customerId,
          limit: 50,
        });

        if (cancelled) return;

        const approvedLogs = logs.filter((l: any) => l.status === "approved");
        const totalDebit = approvedLogs
          .filter((l: any) => l.type === "debit")
          .reduce((sum: number, l: any) => sum + l.amount, 0);
        const totalCredit = approvedLogs
          .filter((l: any) => l.type === "credit")
          .reduce((sum: number, l: any) => sum + l.amount, 0);

        const computedBalance = totalDebit - totalCredit;

        setCustomer({
          id: customerId,
          name: mc.customers?.name || null,
          phone: mc.customers?.phone || "",
          credit_limit: mc.credit_limit,
          current_balance: computedBalance,
          total_debit_amount: totalDebit,
          total_credit_amount: totalCredit,
          transactions: (logs as Transaction[]) || [],
        });
      } catch {
        if (!cancelled) addToastRef.current("Failed to load customer details.", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCustomer();
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
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center px-4 py-3">
          <button onClick={() => router.back()} className="mr-3 p-1 active:scale-95 transition-transform">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-[var(--color-text)]">Customer Detail</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Customer Info Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50">
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
        </div>

        {/* Balance Overview */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Current Balance</p>
              <p className="text-2xl font-bold text-[var(--color-danger)]">
                NPR {customer.current_balance.toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => { setNewLimit(String(customer.credit_limit)); setShowCreditLimitModal(true); }}
              className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-medium text-[var(--color-text)] active:scale-[0.98]"
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
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  balancePercent > 80 ? "bg-[var(--color-danger)]" : balancePercent > 50 ? "bg-[var(--color-accent)]" : "bg-[var(--color-primary)]"
                }`}
                style={{ width: `${Math.min(100, balancePercent)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
              <span>NPR 0</span>
              <span>NPR {customer.credit_limit.toLocaleString()}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-[var(--color-text-muted)]">Total Credit Taken</p>
              <p className="font-bold text-[var(--color-danger)]">NPR {customer.total_debit_amount.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-[var(--color-text-muted)]">Total Paid</p>
              <p className="font-bold text-[var(--color-primary)]">NPR {customer.total_credit_amount.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div>
          <h3 className="font-semibold text-[var(--color-text)] mb-3">Recent Transactions</h3>
          <div className="space-y-2">
            {customer.transactions.length === 0 ? (
              <div className="text-center py-8 text-[var(--color-text-muted)]">
                <p className="text-sm">No transactions yet</p>
              </div>
            ) : (
              customer.transactions.map((tx) => (
                <div key={tx.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-50 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === "debit" ? "bg-[var(--color-danger)]/10" : "bg-[var(--color-primary)]/10"}`}>
                    <span className={`text-lg font-bold ${tx.type === "debit" ? "text-[var(--color-danger)]" : "text-[var(--color-primary)]"}`}>
                      {tx.type === "debit" ? "+" : "-"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-[var(--color-text)] truncate">{tx.description || "No description"}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {new Date(tx.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <p className={`font-bold text-sm ${tx.type === "debit" ? "text-[var(--color-danger)]" : "text-[var(--color-primary)]"}`}>
                    {tx.type === "debit" ? "+" : "-"}NPR {tx.amount.toLocaleString()}
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
          <div className="w-full max-w-md bg-white rounded-t-3xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-[var(--color-text)]">Update Credit Limit</h3>
              <button onClick={() => setShowCreditLimitModal(false)} className="p-1">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-[var(--color-text)]">Credit Limit (NPR)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-lg font-bold border-0 focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
              />
            </div>
            <button
              onClick={handleSaveLimit}
              disabled={savingLimit}
              className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savingLimit ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Save Limit"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
