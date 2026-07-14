"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAdminMerchantDetail, toggleMerchantStatus } from "@/app/actions/admin";

export default function AdminMerchantDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await getAdminMerchantDetail(id);
    setMerchant(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleToggle = async () => {
    if (!merchant) return;
    const result = await toggleMerchantStatus(merchant.id, merchant.status);
    if (result.success && result.newStatus) {
      setMerchant((prev: any) => ({ ...prev, status: result.newStatus }));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="text-center py-16 text-slate-500">
        <p className="text-sm font-medium">Merchant not found</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-red-400 hover:text-red-300">Go back</button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-[var(--a-muted)] hover:text-[var(--a-text)] transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to directory
      </button>

      <div className="bg-[var(--a-surface)] rounded-xl shadow-lg border border-[var(--a-border)] p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--a-text)] tracking-tight">{merchant.businessName || merchant.name || "Unnamed"}</h1>
            <p className="text-sm text-[var(--a-muted)] mt-1">{merchant.phone}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${
              merchant.status === "suspended" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
            }`}>
              {merchant.status}
            </span>
            <button
              onClick={handleToggle}
              className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all ${
                merchant.status === "suspended"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-red-600 hover:bg-red-500 text-white"
              }`}
            >
              {merchant.status === "suspended" ? "Activate" : "Suspend"}
            </button>
          </div>
        </div>

        {/* Detail fields */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider">Owner Name</label>
            <p className="text-sm text-[var(--a-text)] mt-1">{merchant.name || "\u2014"}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider">Business Type</label>
            <p className="text-sm text-[var(--a-text)] mt-1 capitalize">{merchant.businessType || "\u2014"}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider">Address</label>
            <p className="text-sm text-[var(--a-text)] mt-1">{merchant.address || "\u2014"}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider">Created</label>
            <p className="text-sm text-[var(--a-text)] mt-1">{new Date(merchant.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="bg-[var(--a-surface)] rounded-xl shadow-lg border border-[var(--a-border)] p-5">
          <p className="text-3xl font-bold tracking-tight text-emerald-400">{merchant.transactionCount}</p>
          <p className="text-xs text-[var(--a-muted)] mt-1">Total Transactions</p>
        </div>
        <div className="bg-[var(--a-surface)] rounded-xl shadow-lg border border-[var(--a-border)] p-5">
          <p className="text-3xl font-bold tracking-tight text-blue-400">{merchant.customerCount}</p>
          <p className="text-xs text-[var(--a-muted)] mt-1">Customers</p>
        </div>
      </div>
    </div>
  );
}
