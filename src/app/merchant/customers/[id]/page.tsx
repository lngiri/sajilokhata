"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

interface CustomerDetail {
  id: string;
  name: string | null;
  phone: string;
  credit_limit: number;
  current_balance: number;
  total_debit_amount: number;
  total_credit_amount: number;
  transactions: {
    id: string;
    amount: number;
    type: string;
    status: string;
    description: string | null;
    created_at: string;
  }[];
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params?.id as string;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreditLimitModal, setShowCreditLimitModal] = useState(false);
  const [newLimit, setNewLimit] = useState("");

  useEffect(() => {
    loadCustomer();
  }, [customerId]);

  const loadCustomer = async () => {
    // Demo data
    setCustomer({
      id: customerId,
      name: "Ram Shrestha",
      phone: "9841234567",
      credit_limit: 5000,
      current_balance: 3200,
      total_debit_amount: 12500,
      total_credit_amount: 9300,
      transactions: [
        { id: "1", amount: 1500, type: "debit", status: "approved", description: "Rice 15kg", created_at: new Date(Date.now() - 3600000).toISOString() },
        { id: "2", amount: 500, type: "credit", status: "approved", description: "Cash payment", created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: "3", amount: 2200, type: "debit", status: "approved", description: "Groceries weekly", created_at: new Date(Date.now() - 172800000).toISOString() },
      ],
    });
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!customer) return null;

  const balancePercent = (customer.current_balance / customer.credit_limit) * 100;

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
            {customer.transactions.map((tx) => (
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
            ))}
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
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-lg font-bold border-0 focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
              />
            </div>
            <button
              onClick={() => {
                setShowCreditLimitModal(false);
                // Update would happen here
              }}
              className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium active:scale-[0.98] transition-transform"
            >
              Save Limit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
